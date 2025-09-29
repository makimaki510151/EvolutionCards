// gameCore.js

import { getSelectedDeck } from './deckManager.js';
import { updateDisplay, renderHand, showGameOverScreen, showEvolutionScreen } from './uiRenderer.js';
import { applyEvolution, ALL_CARDS, getCardEffectData, getCardMaxEvolution } from './cards.js';

// --- ゲーム状態の定義 ---
export let gameState = {
    deck: [],
    discard: [],
    hand: [],
    currentScore: 0,
    targetScore: 20,
    stage: 1,
    cardsUsedThisTurn: 0,
    maxCardUses: 3,
    highScore: 0,
    evolutionPhase: {
        active: false,
        count: 3,
        candidates: []
    },
    masterCardList: [],

    // 次に使用するカードの数値効果に適用される倍率
    nextScoreMultiplier: 1,
    // 次に使用するカードの使用枚数カウントを無視する回数
    costIgnoreCount: 0
};

// --- ハイスコア処理 ---
const STORAGE_KEY_HIGH_SCORE = 'roguelite_highscore';
function saveHighScore() {
    localStorage.setItem(STORAGE_KEY_HIGH_SCORE, gameState.highScore.toString());
}

/**
 * 山札をシャッフルする (フィッシャー・イェーツ)
 * @param {Array<object>} array - シャッフルする配列
 */
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * 選択されたデッキデータから初期のマスターカードリストを構築する
 */
function setupInitialDeck() {
    const selectedDeck = getSelectedDeck();
    gameState.masterCardList = [];
    selectedDeck.cards.forEach(deckCard => {
        const baseId = deckCard.id.split('_evo')[0];
        const cardData = ALL_CARDS.find(c => c.id === baseId);

        if (cardData) {
            for (let i = 0; i < deckCard.count; i++) {
                const newCard = JSON.parse(JSON.stringify(cardData));
                newCard.evolution = newCard.baseEvolution || 0; // baseEvolutionがない場合は0を初期値とする

                // 🌟 修正1: カードインスタンスにベースIDを追加
                newCard.baseId = newCard.id;

                newCard.id = `${newCard.id}_inst${i}`;
                gameState.masterCardList.push(newCard);
            }
        }
    });

    setupDeckForNewStage();
}

/**
 * マスターカードリストから山札を再構築し、手札をクリアする (ステージ切り替え/ゲーム開始時)
 */
function setupDeckForNewStage() {
    gameState.discard = [];
    gameState.hand = []; // ステージ開始時は手札をクリア
    // masterCardListの最新の状態（進化レベル含む）を元に、deckをディープコピーで再構築
    gameState.deck = JSON.parse(JSON.stringify(gameState.masterCardList));
    shuffle(gameState.deck);

    // ステージ開始時のドローは startTurn(5) で行う
}

export function startGame() {
    gameState.currentScore = 0;
    gameState.stage = 1;
    gameState.targetScore = 20;
    gameState.cardsUsedThisTurn = 0;
    gameState.evolutionPhase.active = false;
    gameState.nextScoreMultiplier = 1;
    gameState.costIgnoreCount = 0;

    setupInitialDeck();
    // 🌟 修正: ステージ開始時の特殊ドローを行うため、引数 5 を渡す
    startTurn(5);
    updateDisplay();
}

/**
 * カードを山札から引く
 * @param {number} count - 引く枚数
 */
export function drawCard(count = 1) {
    for (let i = 0; i < count; i++) {
        if (gameState.deck.length === 0) {
            if (gameState.discard.length > 0) {
                gameState.deck = gameState.discard;
                gameState.discard = [];
                shuffle(gameState.deck);
            } else {
                return;
            }
        }

        const card = gameState.deck.pop();
        if (card) {
            gameState.hand.push(card);
        }
    }
    renderHand();
    updateDisplay();
}

/**
 * ターン開始処理
 * @param {number} [initialDrawCount=0] - ターン開始時に強制的に引く枚数（ステージ1ターン目などに使用）。0の場合は手札を維持し、5枚になるように補充する。
 */
export function startTurn(initialDrawCount = 0) {

    // ターン開始時のリセット処理
    gameState.cardsUsedThisTurn = 0;
    gameState.nextScoreMultiplier = 1;
    gameState.costIgnoreCount = 0;

    let cardsToDraw = 0;

    if (initialDrawCount > 0) {
        // 1. ステージ1ターン目開始時 (startGame, selectEvolutionCardから呼ばれる): 
        //    setupDeckForNewStageで手札は空になっているため、強制的に指定枚数(5枚)をドロー
        cardsToDraw = initialDrawCount;
    } else {
        // 2. 通常のターン開始時 (endTurnから呼ばれる): 
        //    * 🌟 手札を捨てずに維持する
        //    * 5枚になるように足りない分だけ引く
        cardsToDraw = 5 - gameState.hand.length;
    }

    if (cardsToDraw > 0) {
        drawCard(cardsToDraw);
    }

    document.getElementById('end-turn-button').disabled = true;
    updateDisplay();
}

/**
 * ターン終了処理 (自動進行のみで使用される)
 */
export function endTurn() {
    document.getElementById('end-turn-button').disabled = true;
    // endTurnが呼ばれた時点でステージ達成していないか最終チェック
    if (!checkStageCompletion()) {
        // 🌟 修正: 通常のターン開始（手札維持モード）
        startTurn();
    }
}

/**
 * ステージ達成チェック
 * @returns {boolean} - ステージ達成したかどうか
 */
function checkStageCompletion() {
    if (gameState.currentScore >= gameState.targetScore) {

        // 🌟 修正1: 軽い演出（アラート）で中断を知らせる
        alert(`ステージ${gameState.stage}クリア！目標点 ${gameState.targetScore} を達成しました。進化フェーズへ移行します。`);

        // ターンを強制的に中断し、進化フェーズへ移行
        const masterListCopy = JSON.parse(JSON.stringify(gameState.masterCardList));
        shuffle(masterListCopy);

        gameState.evolutionPhase.candidates = masterListCopy.slice(0, 4);

        gameState.evolutionPhase.active = true;
        gameState.evolutionPhase.count = 3;

        updateDisplay();
        showEvolutionScreen();
        return true;
    }
    return false;
}

/**
 * カード効果の適用ロジック (🌟 新規追加)
 * @param {object} card - 使用するカードオブジェクト
 * @param {function} shuffle - gameCore.js内で定義されているシャッフル関数
 */
function applyEffects(card, shuffle) {
    const currentLevel = card.evolution || card.baseEvolution || 0;
    // cards.jsから効果データを取得
    const effectData = getCardEffectData(card, currentLevel);

    // PurgeSelfで使用するmasterCardListからの削除用インスタンスID
    const cardInstanceId = card.id;

    // 捨札に送るべきかどうかを判断するためのフラグ (PurgeSelfの場合にfalseにする)
    let shouldDiscard = true;

    effectData.forEach(effect => {
        const value = effect.value;
        const type = effect.type;

        switch (type) {
            case 'Score':
                // スコア効果はMultiplierの対象
                gameState.currentScore += Math.round(value * gameState.nextScoreMultiplier);
                gameState.nextScoreMultiplier = 1; // 倍率リセット
                break;

            case 'Draw':
                drawCard(value);
                break;

            case 'Multiplier':
                gameState.nextScoreMultiplier = value;
                break;

            case 'CostIgnore':
                gameState.costIgnoreCount += value;
                break;

            // --- 新規効果ロジック ---

            case 'PurgeSelf':
                // PurgeSelf: masterCardListからこのカードインスタンスを永久に削除
                gameState.masterCardList = gameState.masterCardList.filter(c => c.id !== cardInstanceId);
                // スコア効果（purgeScoreとして定義）
                gameState.currentScore += value;
                shouldDiscard = false; // このカードは捨て札に行かない
                break;

            case 'CardUseMod':
                // CardUseMod: 残り使用回数に加算 (cardsUsedThisTurnを減らす)
                gameState.cardsUsedThisTurn = Math.max(0, gameState.cardsUsedThisTurn - value);
                break;

            case 'RetrieveDiscard':
                // RetrieveDiscard: 捨て札からランダムに指定枚数を手札に戻す
                for (let i = 0; i < value; i++) {
                    if (gameState.discard.length > 0) {
                        const randomIndex = Math.floor(Math.random() * gameState.discard.length);
                        const retrievedCard = gameState.discard.splice(randomIndex, 1)[0];
                        gameState.hand.push(retrievedCard);
                    } else {
                        break;
                    }
                }
                break;

            case 'ShuffleDiscard':
                // ShuffleDiscard: 捨て札を山札に戻してシャッフル
                if (gameState.discard.length > 0) {
                    gameState.deck = gameState.deck.concat(gameState.discard);
                    gameState.discard = [];
                    // shuffleはファイルの冒頭で定義されたローカル関数
                    shuffle(gameState.deck);
                }
                break;

            case 'DiscardHand':
                // DiscardHand: 手札からランダムに指定枚数を捨てる (一時しのぎのペナルティなどで使用)
                for (let i = 0; i < value; i++) {
                    if (gameState.hand.length > 0) {
                        const randomIndex = Math.floor(Math.random() * gameState.hand.length);
                        const discardedCard = gameState.hand.splice(randomIndex, 1)[0];
                        gameState.discard.push(discardedCard);
                    } else {
                        break;
                    }
                }
                // 手札をレンダリングし直す
                renderHand();
                break;

            default:
                console.warn(`Unknown effect type: ${type}`);
        }
    });

    return shouldDiscard;
}

/**
 * カード使用処理 (🌟 修正: cardオブジェクトではなくインデックスを受け取るように変更)
 * @param {number} handIndex - 🌟 修正: 使用するカードの手札におけるインデックス
 */
export function useCard(handIndex) { // 🌟 修正: card を削除し、index を handIndex にリネーム
    if (gameState.evolutionPhase.active) return;

    // 🌟 追加: インデックスが不正でないかチェック
    if (handIndex < 0 || handIndex >= gameState.hand.length) {
        console.error("無効な手札インデックス:", handIndex);
        return;
    }

    // 🌟 追加: 使用するカードインスタンスをインデックスから取得
    const usedCard = gameState.hand[handIndex];

    // 1. コスト計算
    const costIgnored = gameState.costIgnoreCount > 0;
    if (!costIgnored) {
        if (gameState.cardsUsedThisTurn >= gameState.maxCardUses) {
            alert("これ以上カードは使えません。ターンを終了してください。");
            return;
        }
        gameState.cardsUsedThisTurn++;
    } else {
        gameState.costIgnoreCount--;
    }

    // 2. 手札からカードを削除
    // DiscardHandの処理があるため、先に削除する
    // 🌟 修正: usedCard のインデックス (handIndex) を使って正確に削除
    gameState.hand.splice(handIndex, 1);

    // 3. 効果適用 (shuffle関数はgameCore.jsのローカル関数としてapplyEffectsに渡す)
    const shouldDiscard = applyEffects(usedCard, shuffle); // 🌟 修正: usedCard を渡す

    // 4. 捨て札へ移動 (PurgeSelf効果でshouldDiscardがfalseになった場合は移動しない)
    if (shouldDiscard) {
        gameState.discard.push(usedCard); // 🌟 修正: usedCard を捨て札に追加
    }

    // 5. ステージ達成チェックと表示更新
    checkStageCompletion();
    renderHand();
    updateDisplay();
}

/**
 * 進化画面でカードが選択されたときの処理
 */
export function selectEvolutionCard(baseCard) {
    if (!gameState.evolutionPhase.active) return;

    const cardBaseInfo = ALL_CARDS.find(c => c.id === baseCard.id);
    if (!cardBaseInfo) return;

    // 🌟 カードごとの最大進化レベルを取得
    const maxEvo = getCardMaxEvolution(cardBaseInfo);

    // 進化可能なカードをマスターリストから検索
    // c.baseId は、setupInitialDeckでカードインスタンスに付与されている
    const targetCard = gameState.masterCardList.find(c =>
        c.baseId === baseCard.id && // ベースIDで検索
        (c.evolution || c.baseEvolution || 0) < maxEvo // 🌟 MAXレベル未満であることを確認
    );

    if (targetCard) {
        applyEvolution(targetCard);
    } else {
        // 進化可能なカードのみが候補に出るため、ここは基本的に実行されないはずだが、念のため。
        alert(`${baseCard.name} は全て最大レベルです。`);
        return;
    }

    gameState.evolutionPhase.count--;
    document.getElementById('evo-count').textContent = gameState.evolutionPhase.count;

    if (gameState.evolutionPhase.count > 0) {
        // 🌟 進化候補リストの生成ロジック

        // masterCardListの中からユニークなカードID(baseId)を取得
        const uniqueCardIds = [...new Set(gameState.masterCardList.map(c => c.baseId))];

        const evolvableCandidates = [];

        // 進化可能なカードのみを抽出し、シャッフル後のリストから4枚選択
        for (const baseId of uniqueCardIds) {
            const cardInfo = ALL_CARDS.find(c => c.id === baseId);
            if (!cardInfo) continue;
            const cardMaxEvo = getCardMaxEvolution(cardInfo);

            // masterCardListの中に、まだ最大レベルに達していないこのカードのインスタンスが存在するか確認
            const isEvolvable = gameState.masterCardList.some(c =>
                c.baseId === baseId && (c.evolution || c.baseEvolution || 0) < cardMaxEvo
            );

            if (isEvolvable) {
                // ALL_CARDSのベース情報を候補として追加
                evolvableCandidates.push(cardInfo);
            }
        }

        // 候補リストをシャッフルして、先頭の4枚を取得
        shuffle(evolvableCandidates);
        gameState.evolutionPhase.candidates = evolvableCandidates.slice(0, 4);

        showEvolutionScreen();
    }

    updateDisplay();
    renderHand();

    // 進化回数が0になったら、次のステージへ
    if (gameState.evolutionPhase.count <= 0) {
        gameState.evolutionPhase.active = false;

        // スコア更新（ハイスコア処理など）
        if (gameState.currentScore > gameState.highScore) {
            gameState.highScore = gameState.currentScore;
            saveHighScore();
        }

        gameState.stage++;
        gameState.targetScore += 20; // ターゲットスコアを増加
        gameState.currentScore = 0; // スコアをリセット

        setupDeckForNewStage(); // 山札・捨て札を再構築
        startTurn(5); // 次のステージの最初のドロー (5枚)
    }
}