// gameCore.js

import { getSelectedDeck } from './deckManager.js'; 
import { updateDisplay, renderHand, showGameOverScreen, showEvolutionScreen } from './uiRenderer.js';
import { applyEvolution, ALL_CARDS } from './cards.js';

// --- ゲーム状態の定義 ---
export let gameState = {
    deck: [],
    discard: [],
    hand: [],
    currentScore: 0,
    targetScore: 10,
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
                newCard.evolution = newCard.baseEvolution; 
                gameState.masterCardList.push(newCard); 
            }
        }
    });

    setupDeckForNewStage();
}

/**
 * マスターカードリストから山札を再構築し、手札を引く (ステージ切り替え/ゲーム開始時)
 */
function setupDeckForNewStage() {
    gameState.discard = [];
    gameState.hand = [];
    gameState.deck = JSON.parse(JSON.stringify(gameState.masterCardList)); 
    shuffle(gameState.deck); 

    drawCard(5); 
}

export function startGame() {
    gameState.currentScore = 0;
    gameState.stage = 1;
    gameState.targetScore = 10;
    gameState.cardsUsedThisTurn = 0;
    gameState.evolutionPhase.active = false;
    gameState.nextScoreMultiplier = 1; 
    gameState.costIgnoreCount = 0; 
    
    setupInitialDeck(); 
    startTurn();
    updateDisplay();
}

/**
 * カードを山札から引く
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
 */
export function startTurn() {
    gameState.discard.push(...gameState.hand);
    gameState.hand = [];
    gameState.cardsUsedThisTurn = 0;
    
    gameState.nextScoreMultiplier = 1;
    gameState.costIgnoreCount = 0; 
    
    const cardsToDraw = 5 - gameState.hand.length;
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
 * カードの効果ロジックを実装。Multiplierを全ての数値効果に適用。
 * @param {object} card - 使用するカードオブジェクト
 */
function applyCardEffects(card) {
    const currentLevel = card.evolution || card.baseEvolution || 0;
    
    const currentMultiplier = gameState.nextScoreMultiplier; 
    
    let isNewMultiplierSet = false;
    let effectConsumed = false;

    card.effects.forEach(effect => {
        const valueKey = Object.keys(effect.params)[0]; 
        const values = effect.params[valueKey];
        let value = values[Math.min(currentLevel, values.length - 1)];
        
        if (effect.type === 'Multiplier') {
            // 倍化カードの効果: 次の倍率を乗算する
            gameState.nextScoreMultiplier *= value;
            isNewMultiplierSet = true;
        }
        
        // Multiplier効果自身を除き、Score, Draw, CostIgnoreの**全ての数値**に、乗算前の現在の倍率を適用
        if (effect.type !== 'Multiplier') {
            value = Math.floor(value * currentMultiplier); 
        }

        if (effect.type === 'CostIgnore') {
            gameState.costIgnoreCount += value;
            effectConsumed = true; 
        } else if (effect.type === 'Score') {
            gameState.currentScore += value; 
            effectConsumed = true;
        } else if (effect.type === 'Draw') {
            if (value > 0) {
                drawCard(value); 
                effectConsumed = true;
            }
        }
    });
    
    // Score, Draw, CostIgnore のいずれかの効果が適用され、かつこのカードでMultiplierを設定していない場合、倍率をリセット
    if (effectConsumed && !isNewMultiplierSet) {
        gameState.nextScoreMultiplier = 1; 
    }
}


/**
 * カード使用時のロジック
 * @param {object} card - 使用するカードオブジェクト
 */
export function useCard(card) {
    if (gameState.evolutionPhase.active) return;

    const isCostIgnored = gameState.costIgnoreCount > 0;
    
    if (!isCostIgnored && gameState.cardsUsedThisTurn >= gameState.maxCardUses) {
        return;
    }

    // 🌟 カード効果を適用
    applyCardEffects(card); 

    // 🌟 修正2: 効果適用直後にステージ達成をチェックし、達成していればターン中断
    if (checkStageCompletion()) {
        // ステージ達成した場合、以降の処理（使用枚数カウント、ターン終了チェック）は不要
        return;
    }

    // カードを手札から捨て札へ
    const cardIndex = gameState.hand.findIndex(c => c === card);
    if (cardIndex !== -1) {
        const usedCard = gameState.hand.splice(cardIndex, 1)[0];
        gameState.discard.push(usedCard);
    }
    
    // 使用枚数カウントのロジック
    if (isCostIgnored) {
        gameState.costIgnoreCount--; 
    } else {
        gameState.cardsUsedThisTurn++; 
    }
    
    renderHand();
    updateDisplay();

    // カード使用回数の上限に達した場合
    if (gameState.cardsUsedThisTurn >= gameState.maxCardUses) {
        endTurn();
    }
}

/**
 * 進化画面でカードが選択されたときの処理
 */
export function selectEvolutionCard(baseCard) {
    if (gameState.evolutionPhase.count <= 0 || !gameState.evolutionPhase.active) return;
    
    const baseId = baseCard.id; 
    const searchId = baseId.split('_evo')[0];
    
    const targetCard = gameState.masterCardList.find(c => c.id.split('_evo')[0] === searchId && (c.evolution || c.baseEvolution || 0) < 2);
    
    if (targetCard) {
        applyEvolution(targetCard);
    } else {
        alert(`${baseCard.name} は全て最大レベルです。`);
    }
    
    gameState.evolutionPhase.count--; 
    document.getElementById('evo-count').textContent = gameState.evolutionPhase.count;

    if (gameState.evolutionPhase.count > 0) {
        const masterListCopy = JSON.parse(JSON.stringify(gameState.masterCardList));
        shuffle(masterListCopy);
        gameState.evolutionPhase.candidates = masterListCopy.slice(0, 4);
        showEvolutionScreen(); 
    }
    else if (gameState.evolutionPhase.count <= 0) {
        gameState.evolutionPhase.active = false;
        
        gameState.stage++;
        gameState.targetScore *= 2; 
        gameState.currentScore = 0;
        
        setupDeckForNewStage(); 
        
        document.getElementById('overlay').classList.add('hidden');
        document.getElementById('evolution-screen').classList.add('hidden');

        startTurn();
    }
    
    updateDisplay();
    renderHand();
}