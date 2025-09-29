// gameCore.js

import { getSelectedDeck } from './deckManager.js'; 
import { updateDisplay, renderHand, showGameOverScreen, showEvolutionScreen } from './uiRenderer.js';
// 🌟 変更点1: getCardEffectData をインポートに追加
import { applyEvolution, ALL_CARDS, getCardEffectData } from './cards.js'; 

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
        //    setupDeckForNewStageで手札は空になっているため、強制的に指定枚数(5枚)をドロー
        cardsToDraw = initialDrawCount;
    } else {
        // 2. 通常のターン開始時 (endTurnから呼ばれる): 
        //    * 🌟 手札を捨てずに維持する
        //    * 5枚になるように足りない分だけ引く
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
 * カード使用処理 (🌟 新規または置き換え)
 * @param {object} card - 使用するカードオブジェクト
 * @param {number} index - 手札におけるインデックス
 */
export function useCard(card, index) {
    if (gameState.evolutionPhase.active) return;

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
    gameState.hand.splice(index, 1);
    
    // 3. 効果適用 (shuffle関数はgameCore.jsのローカル関数としてapplyEffectsに渡す)
    const shouldDiscard = applyEffects(card, shuffle); 

    // 4. 捨て札へ移動 (PurgeSelf効果でshouldDiscardがfalseになった場合は移動しない)
    if (shouldDiscard) {
        gameState.discard.push(card);
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
    if (gameState.evolutionPhase.count <= 0 || !gameState.evolutionPhase.active) return;
    
    const baseId = baseCard.id; 
    // IDの末尾についている _instXX や _evoXX を除去し、元のカードID（score_1など）を取得
    const searchId = baseId.split('_')[0] + '_' + baseId.split('_')[1]; 
    
    const targetCard = gameState.masterCardList.find(c => c.id.includes(searchId) && (c.evolution || c.baseEvolution || 0) < 2);
    
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
        gameState.targetScore += 20;
        gameState.currentScore = 0;
        
        // 🌟 修正: ステージ切り替え時の処理を呼び出し（山札再構築と手札クリア）
        setupDeckForNewStage(); 
        
        document.getElementById('overlay').classList.add('hidden');
        document.getElementById('evolution-screen').classList.add('hidden');

        // 🌟 修正: ステージ開始時の特殊ドローを行うため、引数 5 を渡す
        startTurn(5);
    }
    
    updateDisplay();
    renderHand();
}