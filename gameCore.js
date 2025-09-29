// gameCore.js

import { getSelectedDeck } from './deckManager.js';
import {
    updateDisplay, renderHand, showGameOverScreen, showEvolutionScreen,
    playDrawSFX, playUseSFX, animateDrawCard, playEvolutionSFX
} from './uiRenderer.js';
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
    nextScoreMultiplier: 1,
    costIgnoreCount: 0
};

// --- ハイスコア処理 ---
const STORAGE_KEY_HIGH_SCORE = 'roguelite_highscore';
function saveHighScore() {
    localStorage.setItem(STORAGE_KEY_HIGH_SCORE, gameState.highScore.toString());
}

function loadHighScore() {
    const score = localStorage.getItem(STORAGE_KEY_HIGH_SCORE);
    gameState.highScore = score ? parseInt(score, 10) : 0;
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
        const cardData = ALL_CARDS.find(c => c.id === deckCard.id);

        if (cardData) {
            for (let i = 0; i < deckCard.count; i++) {
                const newCard = JSON.parse(JSON.stringify(cardData));
                newCard.evolution = newCard.baseEvolution || 0;
                newCard.baseId = newCard.id;
                newCard.id = `${newCard.id}_inst${i}_${Math.random()}`; // よりユニークなID
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
    gameState.hand = [];
    gameState.deck = JSON.parse(JSON.stringify(gameState.masterCardList));
    shuffle(gameState.deck);
}

export async function startGame() {
    gameState.currentScore = 0;
    gameState.stage = 1;
    gameState.targetScore = 20;
    gameState.cardsUsedThisTurn = 0;
    gameState.evolutionPhase.active = false;
    gameState.nextScoreMultiplier = 1;
    gameState.costIgnoreCount = 0;
    loadHighScore();

    setupInitialDeck();
    await startTurn(5);
    updateDisplay();
}

/**
 * ターン開始処理
 * @param {number} [initialDrawCount=0] - ターン開始時に強制的に引く枚数
 */
export async function startTurn(initialDrawCount = 0) {
    gameState.cardsUsedThisTurn = 0;
    // nextScoreMultiplier と costIgnoreCount はターンをまたいで持ち越すためリセットしない

    let cardsToDraw = 0;
    if (initialDrawCount > 0) {
        cardsToDraw = initialDrawCount;
    } else {
        cardsToDraw = Math.max(0, 5 - gameState.hand.length);
    }

    if (cardsToDraw > 0) {
        await drawCardsWithAnimation(cardsToDraw);
    }

    document.getElementById('end-turn-button').disabled = false;
    updateDisplay();
}

/**
 * ターン終了処理
 */
export async function endTurn() {
    document.getElementById('end-turn-button').disabled = true;

    // --- 変更点 ---
    // 以前の処理: 手札をすべて捨て札に移動 (コメントアウトまたは削除)
    // gameState.discard.push(...gameState.hand);
    // gameState.hand = [];

    // 手札はそのまま残すため、renderHand() はここでは実行しない
    // -----------------

    // ステージ達成チェックを行い、未達成の場合のみ次のターンに進む
    if (!checkStageCompletion()) {
        // 次のターン開始処理を呼び出し、手札が5枚になるまで自動的にドローする
        await startTurn(0);
    }
}

/**
 * ステージ達成チェック
 * @returns {boolean} - ステージ達成したかどうか
 */
function checkStageCompletion() {
    if (gameState.currentScore >= gameState.targetScore) {
        // alert(`ステージ${gameState.stage}クリア！目標点 ${gameState.targetScore} を達成しました。進化フェーズへ移行します。`);

        // 🌟 修正: デッキ内のユニークなカードIDを抽出し、それらを候補のベースとする
        const uniqueCardIds = [...new Set(gameState.masterCardList.map(c => c.baseId))];
        const evolvableCandidates = [];

        // ユニークなカードIDごとに進化候補をチェック
        for (const baseId of uniqueCardIds) { // 🌟 baseIdをここで定義
            // カードの基本情報（ALL_CARDSから取得）
            const cardInfo = ALL_CARDS.find(c => c.id === baseId);
            if (!cardInfo) continue;

            const cardMaxEvo = getCardMaxEvolution(cardInfo);

            // 🌟 修正: デッキ内に「このbaseId」を持ち、かつ「まだ最大レベルに達していない」インスタンスが一つでもあるかチェック
            const isEvolvable = gameState.masterCardList.some(cardInstance =>
                cardInstance.baseId === baseId && (cardInstance.evolution || cardInstance.baseEvolution || 0) < cardMaxEvo
            );

            if (isEvolvable) {
                // ALL_CARDSのデータにはbaseIdがないため、進化候補として渡すオブジェクトに明示的に設定する
                const candidate = JSON.parse(JSON.stringify(cardInfo));
                candidate.baseId = cardInfo.id; // ALL_CARDSのidをbaseIdとして設定
                evolvableCandidates.push(candidate);
            }
        }

        shuffle(evolvableCandidates);
        gameState.evolutionPhase.candidates = evolvableCandidates.slice(0, 4);

        if (gameState.evolutionPhase.candidates.length === 0) {
            // 進化できるカードがもうない場合
            alert("全てのカードが最大レベルに達しました！");
            proceedToNextStage();
            return true;
        }

        gameState.evolutionPhase.active = true;
        gameState.evolutionPhase.count = 3;

        updateDisplay();
        showEvolutionScreen();
        return true;
    }
    return false;
}

/**
 * カード効果の適用ロジック
 * @param {object} card - 使用するカードオブジェクト
 */
async function applyEffects(card) {
    const currentLevel = card.evolution || card.baseEvolution || 0;
    const effectData = getCardEffectData(card, currentLevel);
    const cardInstanceId = card.id;
    let shouldDiscard = true;

    for (const effect of effectData) {
        const value = effect.value;
        const type = effect.type;

        switch (type) {
            case 'Score':
                gameState.currentScore += Math.round(value * gameState.nextScoreMultiplier);
                gameState.nextScoreMultiplier = 1;
                break;
            case 'Draw':
                await drawCardsWithAnimation(value);
                break;
            case 'Multiplier':
                gameState.nextScoreMultiplier *= value;
                break;
            case 'CostIgnore':
                gameState.costIgnoreCount += value;
                break;
            case 'PurgeSelf':
                gameState.masterCardList = gameState.masterCardList.filter(c => c.id !== cardInstanceId);
                gameState.currentScore += value;
                shouldDiscard = false;
                break;
            case 'CardUseMod':
                gameState.cardsUsedThisTurn = Math.max(0, gameState.cardsUsedThisTurn - value);
                break;
            case 'RetrieveDiscard':
                for (let i = 0; i < value; i++) {
                    if (gameState.discard.length > 0) {
                        const randomIndex = Math.floor(Math.random() * gameState.discard.length);
                        const retrievedCard = gameState.discard.splice(randomIndex, 1)[0];
                        gameState.hand.push(retrievedCard);
                    }
                }
                renderHand();
                break;
            case 'ShuffleDiscard':
                if (gameState.discard.length > 0) {
                    gameState.deck.push(...gameState.discard);
                    gameState.discard = [];
                    shuffle(gameState.deck);
                }
                break;
            case 'DiscardHand':
                for (let i = 0; i < value; i++) {
                    if (gameState.hand.length > 0) {
                        const randomIndex = Math.floor(Math.random() * gameState.hand.length);
                        const discardedCard = gameState.hand.splice(randomIndex, 1)[0];
                        gameState.discard.push(discardedCard);
                    }
                }
                renderHand();
                break;
            default:
                console.warn(`Unknown effect type: ${type}`);
        }
    }
    return shouldDiscard;
}

/**
 * カード使用処理
 * @param {number} handIndex - 使用するカードの手札におけるインデックス
 */
export async function useCard(handIndex) {
    if (gameState.evolutionPhase.active) return;
    if (handIndex < 0 || handIndex >= gameState.hand.length) return;

    const usedCard = gameState.hand[handIndex];

    const costIgnored = gameState.costIgnoreCount > 0;
    if (!costIgnored) {
        // --- 変更点 1: 使用回数オーバー時の警告を削除 ---
        if (gameState.cardsUsedThisTurn >= gameState.maxCardUses) {
            // alert("これ以上カードは使えません。ターンを終了してください。"); // この行を削除/コメントアウト
            return; // 念のため早期リターンは残しておく
        }
        gameState.cardsUsedThisTurn++;
    } else {
        gameState.costIgnoreCount--;
    }

    gameState.hand.splice(handIndex, 1);
    playUseSFX();

    const shouldDiscard = await applyEffects(usedCard);

    if (shouldDiscard) {
        gameState.discard.push(usedCard);
    }

    renderHand();
    updateDisplay();

    // --- 変更点 2: ターン終了の自動判定ロジックを追加 ---
    // コスト無視カウンターが0 かつ、残り使用回数が0 になった場合
    if (gameState.costIgnoreCount === 0 && gameState.cardsUsedThisTurn >= gameState.maxCardUses) {
        // ターン終了の効果音をここで鳴らす場合は、uiRenderer.js に定義を追加する必要があります。
        // 例: playTurnEndSFX();

        // ターンを自動で終了し、次のターンへ移行する
        await endTurn();
    } else {
        // ターンが続行する場合は、ステージ達成チェックのみ行う
        checkStageCompletion();
    }
}

/**
 * 進化画面でカードが選択されたときの処理
 */
export async function selectEvolutionCard(baseCard) {
    if (!gameState.evolutionPhase.active) return;

    const cardBaseInfo = ALL_CARDS.find(c => c.id === baseCard.baseId);
    if (!cardBaseInfo) return;

    const maxEvo = getCardMaxEvolution(cardBaseInfo);

    const evolvableInstances = gameState.masterCardList.filter(c =>
        c.baseId === baseCard.baseId && (c.evolution || c.baseEvolution || 0) < maxEvo
    );

    if (evolvableInstances.length === 0) {
        alert(`${baseCard.name} は全て最大レベルです。別のカードを選びましょう。`);
        return;
    }

    // 最もレベルの低いカードを進化させる
    evolvableInstances.sort((a, b) => (a.evolution || 0) - (b.evolution || 0));
    const targetCard = evolvableInstances[0];

    applyEvolution(targetCard);
    playEvolutionSFX();

    gameState.evolutionPhase.count--;
    if (gameState.evolutionPhase.count > 0) {
        
    } else {
        await proceedToNextStage();
    }
    updateDisplay();
}

async function proceedToNextStage() {
    gameState.evolutionPhase.active = false;

    if (gameState.currentScore > gameState.highScore) {
        gameState.highScore = gameState.currentScore;
        saveHighScore();
    }

    gameState.stage++;
    gameState.targetScore = Math.round(gameState.targetScore * 1.5);
    gameState.currentScore = 0;

    setupDeckForNewStage();
    await startTurn(5);
}

/**
 * 山札からカードを1枚引く内部関数
 * @returns {object|null} 引いたカードオブジェクト、山札がない場合はnull
 */
function internalDrawSingleCard() {
    if (gameState.deck.length === 0) {
        if (gameState.discard.length > 0) {
            gameState.deck.push(...gameState.discard);
            gameState.discard = [];
            shuffle(gameState.deck);
        } else {
            return null;
        }
    }
    const card = gameState.deck.pop();
    if (card) {
        gameState.hand.push(card);
    }
    return card;
}

/**
 * カードを引くアニメーションと効果音付きの関数
 * @param {number} count - 引く枚数
 */
export async function drawCardsWithAnimation(count) {
    for (let i = 0; i < count; i++) {
        // カードを引いて、gameState.handに追加 (この時点で手札の枚数が1増える)
        const cardToDraw = internalDrawSingleCard();

        if (cardToDraw) {
            // ----------------------------------------------------
            // 🌟 修正: 引いたカードオブジェクトと最終的な手札インデックスを渡す
            // ----------------------------------------------------
            const finalIndex = gameState.hand.length - 1;

            // アニメーション実行 (カードの出現/飛行)
            // 🌟 修正: cardToDraw と finalIndex を animateDrawCard に渡す
            await animateDrawCard(cardToDraw, finalIndex);

            // 🌟 修正: アニメーション完了後、手札を再描画して、引いたカードをDOMに表示する
            renderHand();

            playDrawSFX();

            // 1枚引くごとに山札/捨て札の枚数やターン終了ボタンの状態などを更新
            updateDisplay();
            // ----------------------------------------------------
        } else {
            break; // 山札切れ
        }
    }
}