// --- ゲーム状態の定義 ---
let gameState = {
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

// --- DOM要素の取得 ---
const $handArea = document.getElementById('hand-area');
const $scoreInfo = document.getElementById('current-score');
const $targetScore = document.getElementById('target-score');
const $stageInfo = document.getElementById('current-stage');
const $useCount = document.getElementById('card-use-count');
const $deckCount = document.getElementById('deck-count');
const $discardCount = document.getElementById('discard-count');
const $endTurnButton = document.getElementById('end-turn-button');
const $overlay = document.getElementById('overlay');
const $evolutionScreen = document.getElementById('evolution-screen');
const $gameoverScreen = document.getElementById('gameover-screen');
const $evolutionChoices = document.getElementById('evolution-choices');

// --- ユーティリティ関数 ---

/** 配列をシャッフルする */
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/** 初期デッキを準備する */
function setupInitialDeck() {
    let initialDeck = [];
    // 仮の初期デッキ: 基本点(10枚), 加速点(5枚), 倍化(3枚), ドロー(2枚)
    for (let i = 0; i < 10; i++) initialDeck.push({...ALL_CARDS.find(c => c.id === 'score_1')});
    for (let i = 0; i < 5; i++) initialDeck.push({...ALL_CARDS.find(c => c.id === 'score_2')});
    for (let i = 0; i < 3; i++) initialDeck.push({...ALL_CARDS.find(c => c.id === 'combo_x2')});
    for (let i = 0; i < 2; i++) initialDeck.push({...ALL_CARDS.find(c => c.id === 'draw_1')});

    gameState.deck = shuffle(initialDeck);
    gameState.discard = [];
    gameState.hand = [];
}

/** 描画の更新 */
function updateDisplay() {
    $scoreInfo.textContent = gameState.currentScore;
    $targetScore.textContent = gameState.targetScore;
    $stageInfo.textContent = gameState.stage;
    $useCount.textContent = gameState.maxCardUses - gameState.cardsUsedThisTurn;
    $deckCount.textContent = gameState.deck.length;
    $discardCount.textContent = gameState.discard.length;
    
    // ターン終了ボタンの活性化/非活性化 (ここでは常に活性化しておく)
    $endTurnButton.disabled = gameState.evolutionPhase.active;
}

/** カードDOM要素の生成 */
function createCardElement(card, isEvolutionChoice = false) {
    const cardEl = document.createElement('div');
    cardEl.className = `card ${isEvolutionChoice ? 'evolution-choice-card' : ''}`;
    cardEl.innerHTML = `
        <div class="card-title">${card.name}</div>
        <div class="card-effect">${card.effect}</div>
        ${card.evolution > 0 ? `<div class="card-level">Lv.${card.evolution}</div>` : ''}
    `;
    cardEl.dataset.id = card.id;
    cardEl.dataset.index = gameState.hand.indexOf(card);
    cardEl.onclick = () => isEvolutionChoice ? selectEvolutionCard(card) : useCard(card);
    return cardEl;
}

/** 手札の描画 */
function renderHand() {
    $handArea.innerHTML = '<h2>手札</h2>';
    gameState.hand.forEach((card, index) => {
        const cardEl = createCardElement(card);
        cardEl.dataset.index = index; // 手札内でのインデックスを設定
        $handArea.appendChild(cardEl);
    });
}

/** カードを引く */
function drawCard(count = 1) {
    for (let i = 0; i < count; i++) {
        if (gameState.deck.length === 0) {
            // 山札切れ：捨て札をシャッフルして山札にする
            if (gameState.discard.length > 0) {
                gameState.deck = shuffle(gameState.discard);
                gameState.discard = [];
            } else {
                // 山札も捨て札もない（ゲームオーバー判定の可能性）
                break;
            }
        }
        const card = gameState.deck.pop();
        gameState.hand.push(card);
    }
}

/** ターン開始処理 */
function startTurn() {
    gameState.cardsUsedThisTurn = 0;
    // 手札を5枚になるまで引く
    drawCard(5 - gameState.hand.length);
    renderHand();
    updateDisplay();
}

/** カードの使用処理 */
function useCard(card) {
    const cardIndex = gameState.hand.indexOf(card);
    if (cardIndex === -1) return; // カードが手札にない

    let uses = 1; // 使用枚数制限を消費する量

    // 【1】コスト操作カードの効果判定
    if (card.id.startsWith('combo_ignore')) {
        uses = 0; // コスト消費なし
    }

    if (uses > 0 && gameState.cardsUsedThisTurn >= gameState.maxCardUses) {
        alert('今ターンはもうカードを使用できません。');
        return;
    }

    // 【2】カード効果の適用
    let scoreMultiplier = 1;
    let baseScore = card.baseScore || 0; 
    let extraDraw = 0;
    
    // バフ効果の適用 (ここでは未実装だが、次に使うカードの情報を状態に持つ必要がある)

    switch (card.type) {
        case 'Score':
            gameState.currentScore += baseScore * scoreMultiplier;
            break;
        case 'Buff':
            // 本来は次のカードをバフするフラグをgameStateにセットする
            alert(`${card.effect}が発動！ (効果は次のカードに適用される想定)`);
            break;
        case 'Resource':
            if (card.id.startsWith('draw_1')) {
                extraDraw = (card.evolution === 1) ? 2 : 1;
                drawCard(extraDraw);
            } else if (card.id.startsWith('discard_score')) {
                // TODO: 手札から捨てるカードを選択させるUIが必要。ここでは自動で一番左を捨てる処理にする
                if (gameState.hand.length > 1) {
                    const discardedCard = gameState.hand.splice(0, 1)[0]; // 自身以外のカードを捨てる
                    gameState.discard.push(discardedCard);
                    gameState.currentScore += baseScore;
                } else {
                    alert('手札がこれ1枚なので捨てられません。');
                    return;
                }
            } else if (card.id.startsWith('trash_remove')) {
                 alert('手札からカードを永久に除去するUIが必要です。今回はスキップします。');
            }
            break;
    }

    // 【3】カードの移動と使用回数更新
    if (uses > 0) {
        gameState.cardsUsedThisTurn += uses;
    }
    
    // カードを手札から捨て札へ
    gameState.hand.splice(cardIndex, 1);
    gameState.discard.push(card);
    
    renderHand();
    checkStageCompletion(); // ステージクリア判定
    updateDisplay();
}

/** ターン終了処理 */
function endTurn() {
    // 手札を全て捨て札へ移動
    gameState.discard.push(...gameState.hand);
    gameState.hand = [];
    
    checkGameOver(); // ゲームオーバー判定
    
    if ($gameoverScreen.classList.contains('hidden')) {
        startTurn();
    }
}

/** ステージクリア判定 */
function checkStageCompletion() {
    if (gameState.currentScore >= gameState.targetScore) {
        // ステージクリア！
        gameState.evolutionPhase.active = true;
        gameState.evolutionPhase.count = 3;
        
        // 残りの手札と捨て札を結合し、進化の候補を選ぶ
        const allCards = [...gameState.hand, ...gameState.discard, ...gameState.deck];
        // 重複を除き、シャッフルした後の最初の4枚を候補にする (簡易化のため重複は考慮しない)
        const uniqueCards = [...new Set(allCards.map(c => c.id))].map(id => ALL_CARDS.find(c => c.id === id) || allCards.find(c => c.id === id.split('_evo')[0]));
        gameState.evolutionPhase.candidates = shuffle(uniqueCards).slice(0, 4);

        showEvolutionScreen();
    }
}

/** ゲームオーバー判定 */
function checkGameOver() {
    // デッキと手札が空で目標未達成の場合
    if (gameState.currentScore < gameState.targetScore && gameState.deck.length === 0 && gameState.hand.length === 0) {
        showGameOverScreen();
    }
}

// --- 進化フェーズ処理 ---

function showEvolutionScreen() {
    $overlay.classList.remove('hidden');
    $evolutionScreen.classList.remove('hidden');
    $gameoverScreen.classList.add('hidden');
    renderEvolutionChoices();
    document.getElementById('evo-count').textContent = gameState.evolutionPhase.count;
}

function renderEvolutionChoices() {
    $evolutionChoices.innerHTML = '';
    gameState.evolutionPhase.candidates.forEach(card => {
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'evolution-card-wrapper';
        const cardEl = createCardElement(card, true);
        cardWrapper.appendChild(cardEl);
        $evolutionChoices.appendChild(cardWrapper);
    });
}

function selectEvolutionCard(card) {
    if (gameState.evolutionPhase.count <= 0) return;

    // 1. デッキ内の同じカード（同じID）を検索し、進化を適用
    const targetCardID = card.id;

    // 全てのカードプール（デッキ、捨て札、手札）をチェック
    const allCards = [...gameState.deck, ...gameState.discard, ...gameState.hand];
    
    let evolvedCount = 0;
    for (let i = 0; i < allCards.length; i++) {
        const deckCard = allCards[i];
        // IDが一致するか、IDのベース部分が一致（進化済みのカードを進化させる場合）
        if (deckCard.id === targetCardID || deckCard.id.split('_evo')[0] === targetCardID.split('_evo')[0]) {
            // ALL_CARDSのapplyEvolution関数で進化ロジックを適用
            Object.assign(deckCard, applyEvolution(deckCard));
            evolvedCount++;
        }
    }

    if (evolvedCount === 0) {
        alert("エラー: デッキ内に進化対象のカードが見つかりませんでした。");
        return;
    }
    
    // 2. 進化回数を減らし、UIを更新
    gameState.evolutionPhase.count--;
    document.getElementById('evo-count').textContent = gameState.evolutionPhase.count;
    
    if (gameState.evolutionPhase.count === 0) {
        // 進化フェーズ終了
        endEvolutionPhase();
    } else {
        // 次の候補を再抽選 (簡易化のため、今回は同じ候補から再選択可能にする)
        // 本来は、選択済みのカードを候補から外したり、新しい候補を提示する処理が必要
        renderEvolutionChoices();
    }
}

function endEvolutionPhase() {
    // ステージを進行
    gameState.stage++;
    gameState.currentScore = 0; // スコアをリセット
    gameState.targetScore = Math.ceil(gameState.targetScore * 1.5); // 目標点を1.5倍に増加（仮）

    // 残りのカードを全てデッキに戻してシャッフル
    gameState.deck.push(...gameState.discard, ...gameState.hand);
    gameState.discard = [];
    gameState.hand = [];
    shuffle(gameState.deck);

    gameState.evolutionPhase.active = false;
    $evolutionScreen.classList.add('hidden');
    $overlay.classList.add('hidden');
    startTurn();
}


// --- ゲームオーバー処理 ---

function showGameOverScreen() {
    $overlay.classList.remove('hidden');
    $gameoverScreen.classList.remove('hidden');
    $evolutionScreen.classList.add('hidden');
    
    const finalStage = gameState.stage;
    const finalScore = gameState.currentScore;
    
    gameState.highScore = Math.max(gameState.highScore, finalScore);
    
    document.getElementById('final-stage').textContent = finalStage;
    document.getElementById('high-score').textContent = gameState.highScore;

    // TODO: localStorageに最高スコアなどを保存する処理
}

// --- イベントリスナー ---
$endTurnButton.addEventListener('click', endTurn);
document.getElementById('restart-button').addEventListener('click', startGame);


// --- ゲーム開始 ---
function startGame() {
    // 状態をリセット
    gameState.currentScore = 0;
    gameState.stage = 1;
    gameState.targetScore = 10;
    gameState.cardsUsedThisTurn = 0;
    gameState.evolutionPhase.active = false;
    
    // 画面をリセット
    $overlay.classList.add('hidden');
    $gameoverScreen.classList.add('hidden');
    
    // デッキを構築
    setupInitialDeck();
    
    // ターン開始
    startTurn();
    updateDisplay();
    // TODO: localStorageからハイスコアをロードする処理
}

// 初回起動
startGame();