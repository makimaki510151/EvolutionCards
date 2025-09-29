// gameCore.js

import { getSelectedDeck } from './deckManager.js';
import {
    updateDisplay, renderHand, showGameOverScreen, showEvolutionScreen,
    playDrawSFX, playUseSFX, animateDrawCard, playEvolutionSFX, renderEvolutionChoices
} from './uiRenderer.js';
import { applyEvolution, ALL_CARDS, getCardEffectData, getCardMaxEvolution, generateEffectText } from './cards.js';

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
                // 🌟 個別レベル管理のため、進化レベルをインスタンスごとに 'evolution' プロパティで持つ
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
    // 🌟 masterCardListのインスタンスをディープコピーしてdeckを構築する
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

    // ステージ達成チェックを行い、未達成の場合のみ次のターンに進む
    if (!checkStageCompletion()) {
        // 次のターン開始処理を呼び出し、手札が5枚になるまで自動的にドローする
        await startTurn(0);

        // 🌟 修正点: ドロー後の手札の状態で、ステージ未達成 AND 手札が空ならゲームオーバー
        const isHandEmpty = gameState.hand.length === 0;
        const isStageFailed = gameState.currentScore < gameState.targetScore;

        // 手札が空（ドローもできず）で、かつステージ未達成ならゲームオーバー
        // 捨て札にカードがあっても、手札がないためシャッフルするカードを使えず、詰みと判断する
        if (isHandEmpty && isStageFailed) {
            showGameOverScreen();
        }
    }
}

/**
 * ステージ達成チェック
 * @returns {boolean} - ステージ達成したかどうか
 */
function checkStageCompletion() {
    if (gameState.currentScore >= gameState.targetScore) {
        // alert(`ステージ${gameState.stage}クリア！目標点 ${gameState.targetScore} を達成しました。進化フェーズへ移行します。`);

        // 🌟 修正: 進化候補を生成
        generateEvolutionCandidates();

        if (gameState.evolutionPhase.candidates.length === 0) {
            // 進化できるカードがもうない場合
            // alert("全てのカードが最大レベルに達しました！");
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
 * @param {object} card - 使用するカードオブジェクト (インスタンス)
 */
async function applyEffects(card) {
    // 🌟 修正: card.evolution を優先して使用
    const currentLevel = card.evolution !== undefined ? card.evolution : (card.baseEvolution || 0);
    const effectData = getCardEffectData(card, currentLevel);
    const cardInstanceId = card.id;
    let shouldDiscard = true;

    // 🌟 修正点: 次のカードではなく、このカードの数値効果すべてに適用するように修正
    let multiplier = gameState.nextScoreMultiplier; // 現在の倍率を取得
    gameState.nextScoreMultiplier = 1; // 効果適用前に倍率をリセット

    for (const effect of effectData) {
        let value = effect.value;
        const type = effect.type;

        // 🌟 修正点: Score, Draw, CostIgnore, PurgeSelf, CardUseMod, RetrieveDiscard, DiscardHand に倍率を適用
        const shouldApplyMultiplier = ['Score', 'Draw', 'CostIgnore', 'PurgeSelf', 'CardUseMod', 'RetrieveDiscard', 'DiscardHand'].includes(type);

        if (shouldApplyMultiplier && type !== 'Multiplier' && type !== 'ShuffleDiscard') {
            value = Math.round(value * multiplier); // 値を倍率で乗算
            value = Math.max(0, value); // 負の数値にならないように制限 (例: Draw -1枚など)
        }

        switch (type) {
            case 'Score':
                // 🌟 修正: すでに倍率が適用されているvalueを使用
                gameState.currentScore += value;
                break;
            case 'Draw':
                // 🌟 修正: すでに倍率が適用されているvalueを使用
                await drawCardsWithAnimation(value);
                break;
            case 'Multiplier':
                // Multiplier効果は倍率を重ねがけし、次回の適用時にリセットされるようにする (上書きではなく乗算)
                gameState.nextScoreMultiplier *= value;
                break;
            case 'CostIgnore':
                // 🌟 修正: すでに倍率が適用されているvalueを使用
                gameState.costIgnoreCount += value;
                break;
            case 'PurgeSelf':
                gameState.masterCardList = gameState.masterCardList.filter(c => c.id !== cardInstanceId);
                // 🌟 修正: すでに倍率が適用されているvalueを使用
                gameState.currentScore += value;
                shouldDiscard = false;
                break;
            case 'CardUseMod':
                // 🌟 修正: すでに倍率が適用されているvalueを使用
                gameState.cardsUsedThisTurn = Math.max(0, gameState.cardsUsedThisTurn - value);
                break;
            case 'RetrieveDiscard':
                // 🌟 修正: すでに倍率が適用されているvalueを使用
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
                // 🌟 修正: すでに倍率が適用されているvalueを使用
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
        if (gameState.cardsUsedThisTurn >= gameState.maxCardUses) {
            return;
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

    // ターン途中のゲームオーバー判定ロジック
    const isHandEmpty = gameState.hand.length === 0;
    const isDeckTotallyEmpty = gameState.deck.length === 0 && gameState.discard.length === 0;

    // プレイ中に「山札が空」し、「手札も空」になったらゲームオーバー
    if (isHandEmpty && isDeckTotallyEmpty && gameState.currentScore < gameState.targetScore) {
        showGameOverScreen();
        return;
    }


    // ターン終了の自動判定ロジック
    if (gameState.costIgnoreCount === 0 && gameState.cardsUsedThisTurn >= gameState.maxCardUses) {
        await endTurn();
    } else {
        checkStageCompletion();
    }
}

/**
 * 進化画面でカードが選択されたときの処理
 * @param {object} baseCard - ALL_CARDSからコピーされた、進化のベースとなるカードオブジェクト (インスタンスIDを含む)
 */
export async function selectEvolutionCard(baseCard) {
    if (!gameState.evolutionPhase.active) return;

    // 🌟 修正: baseCard.id (ユニークなインスタンスID) を使用して、進化対象のカードインスタンスを特定
    const targetCardId = baseCard.id;

    // 🌟 修正: ユニークIDでインスタンスを直接見つける
    const targetCard = gameState.masterCardList.find(c => c.id === targetCardId);

    if (!targetCard) {
        console.error("進化対象のカードインスタンスが見つかりませんでした:", targetCardId);
        return;
    }

    // 最大レベルチェック
    const currentLevel = targetCard.evolution !== undefined ? targetCard.evolution : (targetCard.baseEvolution || 0);
    if (getCardMaxEvolution(targetCard) <= currentLevel) {
        generateEvolutionCandidates();
        renderEvolutionChoices();
        return;
    }

    // cards.jsのapplyEvolutionを呼び出し、targetCardの'evolution'プロパティが更新される
    applyEvolution(targetCard);
    playEvolutionSFX();

    gameState.evolutionPhase.count--; // 回数を減らす

    if (gameState.evolutionPhase.count > 0) {
        // 候補を再生成し、再描画
        generateEvolutionCandidates();
        renderEvolutionChoices();
    } else {
        // 🌟 修正点: 進化回数が0になったら、次のステージへ進む処理を呼び出し、画面を閉じる
        await proceedToNextStage(true); // 画面を閉じる指示
    }
    updateDisplay();
}

/**
 * 進化候補カード4枚を生成し、gameState.evolutionPhase.candidatesに格納する
 */
function generateEvolutionCandidates() {
    // 🌟 変更点: 進化可能なすべてのカードインスタンスを候補として抽出（baseIdの重複OK）
    const allEvolvableInstances = gameState.masterCardList.filter(cardInstance => {
        const currentLevel = cardInstance.evolution !== undefined ? cardInstance.evolution : (cardInstance.baseEvolution || 0);
        // getCardMaxEvolution(cardInstance) を呼び出すために、カードインスタンス自体を渡す
        return getCardMaxEvolution(cardInstance) > currentLevel;
    });

    // 進化可能なインスタンスがない場合は空の配列で終了
    if (allEvolvableInstances.length === 0) {
        gameState.evolutionPhase.candidates = [];
        return;
    }

    // 2. 候補リストをシャッフルし、最大4枚を選ぶ
    shuffle(allEvolvableInstances);
    const selectedInstances = allEvolvableInstances.slice(0, 4);

    // 3. 選択されたインスタンスから表示用の候補オブジェクトを作成
    gameState.evolutionPhase.candidates = selectedInstances.map(instance => {
        // ALL_CARDSのデータをコピーして表示用オブジェクトを作成
        const cardInfo = ALL_CARDS.find(c => c.id === instance.baseId);
        const candidate = JSON.parse(JSON.stringify(cardInfo));

        // 🌟 選択されたインスタンスのユニークなIDとレベルを保持
        candidate.id = instance.id; // 選択されたインスタンスのユニークID
        candidate.baseId = instance.baseId; // カードの種類ID
        candidate.evolution = instance.evolution; // 現在の進化レベル

        return candidate;
    });
}

// 🌟 修正: 引数に画面を閉じるためのフラグを追加
async function proceedToNextStage(closeEvolutionScreen = false) {
    gameState.evolutionPhase.active = false;

    if (gameState.currentScore > gameState.highScore) {
        gameState.highScore = gameState.currentScore;
        saveHighScore();
    }

    gameState.stage++;
    gameState.targetScore = Math.round(gameState.targetScore * 1.5);
    gameState.currentScore = 0;

    setupDeckForNewStage();

    // 🌟 修正: closeEvolutionScreen が true の場合、ここで画面を閉じる処理を呼び出す
    if (closeEvolutionScreen) {
        // UI側の関数を呼び出して進化画面を閉じる処理
        const $overlay = document.getElementById('overlay');
        const $evolutionScreen = document.getElementById('evolution-screen');
        if ($overlay && $evolutionScreen) {
            $overlay.classList.add('hidden');
            $evolutionScreen.classList.add('hidden');
        }
    }

    await startTurn(5);
}

/**
 * 山札からカードを1枚引く内部関数
 * @returns {object|null} 引いたカードオブジェクト、山札がない場合はnull
 */
function internalDrawSingleCard() {
    if (gameState.deck.length === 0) {
        return null;
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
        const cardToDraw = internalDrawSingleCard();

        if (cardToDraw) {
            const finalIndex = gameState.hand.length - 1;

            await animateDrawCard(cardToDraw, finalIndex);

            renderHand();

            playDrawSFX();

            updateDisplay();
        } else {
            break; // 山札切れ
        }
    }
}