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

    // ターン終了の自動判定ロジック
    if (gameState.costIgnoreCount === 0 && gameState.cardsUsedThisTurn >= gameState.maxCardUses) {
        await endTurn();
    } else {
        checkStageCompletion();
    }
}

/**
 * 進化画面でカードが選択されたときの処理
 * @param {object} baseCard - ALL_CARDSからコピーされた、進化のベースとなるカードオブジェクト
 */
export async function selectEvolutionCard(baseCard) {
    if (!gameState.evolutionPhase.active) return;

    // 🌟 修正: baseCard.baseId を使用して、進化対象のカードインスタンスを特定
    const cardBaseId = baseCard.baseId;

    // 進化可能なインスタンスをフィルタリング
    let evolvableInstances = gameState.masterCardList.filter(c =>
        c.baseId === cardBaseId && getCardMaxEvolution(c) > (c.evolution !== undefined ? c.evolution : (c.baseEvolution || 0))
    );

    if (evolvableInstances.length === 0) {
        // これはgenerateEvolutionCandidatesで排除されるはずだが、念のため。
        // alert(`${baseCard.name} は全て最大レベルです。別のカードを選びましょう。`);
        generateEvolutionCandidates();
        renderEvolutionChoices();
        return;
    }

    // 🌟 変更: 最もレベルの低いカードインスタンスを進化させる
    // card.evolutionが未定義の場合は0としてソート
    evolvableInstances.sort((a, b) => 
        (a.evolution !== undefined ? a.evolution : (a.baseEvolution || 0)) - 
        (b.evolution !== undefined ? b.evolution : (b.baseEvolution || 0))
    );
    const targetCard = evolvableInstances[0];

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
    // 🌟 変更点: 進化可能なすべてのカードインスタンスの baseId を重複なく抽出し、ランダムに4種類を選ぶ

    // 1. 進化可能なカードインスタンスの baseId を抽出
    const evolvableBaseIds = new Set();
    gameState.masterCardList.forEach(cardInstance => {
        const currentLevel = cardInstance.evolution !== undefined ? cardInstance.evolution : (cardInstance.baseEvolution || 0);
        // 最大レベルに達していないカードインスタンスの baseId のみを抽出
        if (getCardMaxEvolution(cardInstance) > currentLevel) {
            evolvableBaseIds.add(cardInstance.baseId);
        }
    });
    
    // 進化可能な baseId がない場合は空の配列で終了
    if (evolvableBaseIds.size === 0) {
        gameState.evolutionPhase.candidates = [];
        return;
    }

    // 2. 抽出した baseId に対応する ALL_CARDS のデータを候補として準備
    const allCandidates = Array.from(evolvableBaseIds).map(baseId => {
        const cardInfo = ALL_CARDS.find(c => c.id === baseId);
        if (cardInfo) {
            // ALL_CARDSのデータをコピーし、baseIdを設定して返す
            const candidate = JSON.parse(JSON.stringify(cardInfo));
            candidate.baseId = cardInfo.id; 
            
            // 🌟 最もレベルの低いインスタンスの現在のレベルを表示のために取得
            const lowestLevelInstance = gameState.masterCardList
                .filter(c => c.baseId === baseId)
                .sort((a, b) => 
                    (a.evolution !== undefined ? a.evolution : (a.baseEvolution || 0)) - 
                    (b.evolution !== undefined ? b.evolution : (b.baseEvolution || 0))
                )[0];
            
            // 候補カード自体にも進化前のレベル情報を持たせて、uiRendererで表示できるようにする
            candidate.evolution = lowestLevelInstance.evolution !== undefined ? lowestLevelInstance.evolution : (lowestLevelInstance.baseEvolution || 0);

            return candidate;
        }
        return null;
    }).filter(c => c !== null);


    // 3. 候補リストをシャッフルし、最大4枚を選ぶ
    shuffle(allCandidates);
    gameState.evolutionPhase.candidates = allCandidates.slice(0, 4);
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
        if (gameState.discard.length > 0) {
            // 🌟 修正: 捨て札を山札に戻す際に、カードインスタンスの'id'や'evolution'プロパティを保持したまま移動する
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