// gameCore.js

import { getPlayerDecks, getSelectedDeck } from './deckManager.js'; // <- getSelectedDeck を使用
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
    }
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
 * 選択されたデッキデータからゲームで使う山札を構築する
 */
function setupInitialDeck() {
    const selectedDeck = getSelectedDeck();
    gameState.deck = [];
    gameState.discard = [];
    gameState.hand = [];

    // デッキ定義を展開して実際のカードオブジェクトの配列を作る
    selectedDeck.cards.forEach(deckCard => {
        const cardData = ALL_CARDS.find(c => c.id === deckCard.id);
        if (cardData) {
            for (let i = 0; i < deckCard.count; i++) {
                // カードデータはディープコピーして進化レベルなどを個別管理できるようにする
                const newCard = JSON.parse(JSON.stringify(cardData));
                newCard.evolution = newCard.baseEvolution; // 初期進化レベルを設定
                gameState.deck.push(newCard);
            }
        }
    });

    shuffle(gameState.deck);
}

// (実装例: startGame)
export function startGame() {
    // 状態をリセット
    gameState.currentScore = 0;
    gameState.stage = 1;
    gameState.targetScore = 10;
    gameState.cardsUsedThisTurn = 0;
    gameState.evolutionPhase.active = false;

    // 選択されたデッキを構築
    setupInitialDeck(); // デッキのセットアップ

    // ターン開始
    startTurn();
    updateDisplay();
}

/**
 * カードを山札から引く
 * @param {number} count - 引く枚数
 */
export function drawCard(count = 1) {
    for (let i = 0; i < count; i++) {
        if (gameState.deck.length === 0) {
            // 山札が尽きたら捨て札を山札に戻してシャッフル
            if (gameState.discard.length > 0) {
                gameState.deck = gameState.discard;
                gameState.discard = [];
                shuffle(gameState.deck);
            } else {
                // 山札も捨て札もない場合はこれ以上引けない
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
    gameState.cardsUsedThisTurn = 0; // 使用枚数リセット
    drawCard(5); // 初期手札は5枚引く
    updateDisplay();
}

/**
 * ターン終了処理
 */
export function endTurn() {
    // 手札を捨て札に移動
    gameState.discard.push(...gameState.hand);
    gameState.hand = [];

    // ステージ達成チェック (この処理は checkStageCompletion() が担うが、ターン終了後もスコアは変わらないため、ここではスキップ)

    // 新しいターンを開始
    startTurn();
    updateDisplay();
}

/**
 * ステージ達成チェック
 */
function checkStageCompletion() {
    if (gameState.currentScore >= gameState.targetScore) {
        // ステージクリア後の進化処理
        
        // 進化候補の選定
        const allCardsInDeck = [...gameState.deck, ...gameState.discard, ...gameState.hand];
        // 重複を除外
        const uniqueCards = Array.from(new Set(allCardsInDeck.map(c => c.id.split('_evo')[0]))); 

        gameState.evolutionPhase.candidates = [];
        
        // ALL_CARDSからカードデータを取得（ディープコピーしてLv.0として扱う）
        const candidatesData = uniqueCards.map(id => {
            const baseCard = ALL_CARDS.find(c => c.id === id);
            return JSON.parse(JSON.stringify(baseCard));
        });
        
        // ランダムに3枚選択 (簡略化のため全種類からランダム選択)
        shuffle(candidatesData);
        gameState.evolutionPhase.candidates = candidatesData.slice(0, 3);
        
        gameState.evolutionPhase.active = true;
        gameState.evolutionPhase.count = 3; // 進化回数を3に設定
        
        showEvolutionScreen(); // uiRenderer.jsの関数
    }
}

/**
 * カード使用時のロジック
 * @param {object} card - 使用するカードオブジェクト
 */
export function useCard(card) {
    if (gameState.cardsUsedThisTurn >= gameState.maxCardUses) {
        alert("これ以上カードは使えません。ターンを終了してください。");
        return;
    }

    // カード効果の適用 (今回はスコアのみを実装)
    const scoreEffect = card.effects.find(e => e.type === 'Score');
    if (scoreEffect) {
        const currentLevel = card.evolution || card.baseEvolution || 0;
        const scoreValue = scoreEffect.params.score[Math.min(currentLevel, scoreEffect.params.score.length - 1)];
        // 実際は倍率やコスト無視の処理を考慮する必要があるが、ここでは簡略化
        gameState.currentScore += scoreValue; 
    }

    // カードを手札から捨て札へ
    const cardIndex = gameState.hand.findIndex(c => c.id === card.id);
    if (cardIndex !== -1) {
        const usedCard = gameState.hand.splice(cardIndex, 1)[0];
        gameState.discard.push(usedCard);
    }
    
    // 使用枚数カウント
    gameState.cardsUsedThisTurn++;
    
    drawCard(1); // 1枚ドロー (簡略化)
    
    renderHand(); // uiRenderer.jsの関数
    checkStageCompletion();
    updateDisplay();
}

/**
 * 進化画面でカードが選択されたときの処理
 * @param {object} baseCard - 進化対象として選ばれたベースカードデータ
 */
export function selectEvolutionCard(baseCard) {
    if (gameState.evolutionPhase.count <= 0 || !gameState.evolutionPhase.active) return;
    
    // 選択されたカードと同じID（ベースID）を持つカードを山札/捨て札/手札から探して進化させる
    const baseId = baseCard.id;
    
    const allCards = [...gameState.deck, ...gameState.discard, ...gameState.hand];
    
    // 実際に進化させるカード
    const targetCard = allCards.find(c => c.id.split('_evo')[0] === baseId && (c.evolution || c.baseEvolution || 0) < 2);
    
    if (targetCard) {
        applyEvolution(targetCard); // cards.jsの関数で進化レベルを上げる
        gameState.evolutionPhase.count--; // 進化回数を減らす
    } else {
        // すべて最大レベルの場合、進化回数を消費するだけ
        alert(`${baseCard.name} は全て最大レベルです。`);
        gameState.evolutionPhase.count--;
    }
    
    // 残り回数を更新
    document.getElementById('evo-count').textContent = gameState.evolutionPhase.count;

    if (gameState.evolutionPhase.count <= 0) {
        // 進化フェーズ終了
        gameState.evolutionPhase.active = false;
        
        // 次のステージへ
        gameState.stage++;
        gameState.targetScore *= 2; // 目標スコアを倍にする
        
        // オーバレイを非表示にし、ゲームを続行
        document.getElementById('overlay').classList.add('hidden');
        document.getElementById('evolution-screen').classList.add('hidden');

        // 新しいターンを開始
        startTurn();
    }
    
    updateDisplay();
}