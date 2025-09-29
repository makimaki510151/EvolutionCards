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

// --- データのキーと初期データ ---
const STORAGE_KEY_DECKS = 'roguelite_decks';
const STORAGE_KEY_HIGH_SCORE = 'roguelite_highscore';

// 🌟 初期デッキの定義
const INITIAL_DECK_TEMPLATE = {
    name: "初期デッキ",
    cards: [
        { id: 'score_1', count: 10 },
        { id: 'score_2', count: 5 },
        { id: 'combo_x2', count: 3 },
        { id: 'draw_1', count: 2 },
    ]
};

let playerDecks = [];
let selectedDeckIndex = 0;

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

// 🌟 追加 DOM要素
const $titleScreen = document.getElementById('title-screen');
const $deckSelectScreen = document.getElementById('deck-select-screen');
const $deckManagementScreen = document.getElementById('deck-management-screen');
const $gameContainer = document.getElementById('game-container');
const $deckListSelect = document.getElementById('deck-list-select');
const $deckListManagement = document.getElementById('deck-list-management');


// --- ローカルストレージ処理 ---

function loadDeckData() {
    const data = localStorage.getItem(STORAGE_KEY_DECKS);
    if (data) {
        playerDecks = JSON.parse(data);
    } else {
        // データがない場合は初期デッキを作成
        playerDecks.push(INITIAL_DECK_TEMPLATE);
        saveDeckData();
    }
    // ハイスコアのロード
    const hs = localStorage.getItem(STORAGE_KEY_HIGH_SCORE);
    if (hs) {
        gameState.highScore = parseInt(hs) || 0;
    }
}

function saveDeckData() {
    localStorage.setItem(STORAGE_KEY_DECKS, JSON.stringify(playerDecks));
}

function saveHighScore() {
    localStorage.setItem(STORAGE_KEY_HIGH_SCORE, gameState.highScore.toString());
}


// --- ユーティリティ関数 ---

/** 配列をシャッフルする */
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/** 初期デッキを準備する (選択されたデッキを使うように変更) */
function setupInitialDeck() {
    const deckTemplate = playerDecks[selectedDeckIndex];
    let initialDeck = [];
    
    // テンプレートから実際のカードオブジェクトの配列を生成
    deckTemplate.cards.forEach(cardData => {
        // ALL_CARDSはcards.jsで定義されているものとする
        const baseCard = ALL_CARDS.find(c => c.id === cardData.id);
        if (baseCard) {
            for (let i = 0; i < cardData.count; i++) {
                initialDeck.push({...baseCard}); // 新しいオブジェクトとして追加
            }
        }
    });

    // デッキサイズチェック（20枚固定を想定）
    if (initialDeck.length !== 20) {
        // デッキサイズが不正な場合は警告を出し、強制的に初期テンプレートで再構築する
        alert(`選択されたデッキは20枚ではありません (${initialDeck.length}枚)。初期デッキの構成で開始します。`);
        initialDeck = [];
        INITIAL_DECK_TEMPLATE.cards.forEach(cardData => {
            const baseCard = ALL_CARDS.find(c => c.id === cardData.id);
            if (baseCard) {
                for (let i = 0; i < cardData.count; i++) {
                    initialDeck.push({...baseCard});
                }
            }
        });
    }

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
    
    // ターン終了ボタンの活性化/非活性化 (進化中は非活性)
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
    // 手札内のインデックスはレンダリング時に設定
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
    
    // TODO: バフ効果の適用ロジックをここに実装

    switch (card.type) {
        case 'Score':
            gameState.currentScore += baseScore * scoreMultiplier;
            break;
        case 'Buff':
            alert(`${card.effect}が発動！ (効果は次のカードに適用される想定)`);
            break;
        case 'Resource':
            if (card.id.startsWith('draw_1')) {
                const extraDraw = (card.evolution === 1) ? 2 : 1;
                drawCard(extraDraw);
            } else if (card.id.startsWith('discard_score')) {
                // 簡易化のため、自身以外のカードが手札にあれば自動で一番左を捨てる処理
                if (gameState.hand.length > 1) {
                    // NOTE: useCard処理で自身がhandから取り除かれる前に、捨てるカードを選択する必要があるが、
                    // 簡易実装のため、自身以外のカードがあればスコアを付与し、捨て札ロジックをスキップ
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
        
        // 進化の候補を選ぶ
        const allCards = [...gameState.hand, ...gameState.discard, ...gameState.deck];
        const uniqueCards = [...new Set(allCards.map(c => c.id))].map(id => {
            // ALL_CARDSから元のカード定義を取得
            const baseId = id.split('_evo')[0];
            return {...ALL_CARDS.find(c => c.id === baseId) || allCards.find(c => c.id === id)}; // 進化情報を含む現在のカードも使用
        });
        
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
    const targetBaseID = card.id.split('_evo')[0]; // 元のカードIDを取得

    // 全てのカードプール（デッキ、捨て札、手札）をチェック
    const allCards = [...gameState.deck, ...gameState.discard, ...gameState.hand];
    
    let evolvedCount = 0;
    for (let i = 0; i < allCards.length; i++) {
        const deckCard = allCards[i];
        // 元のIDが一致するカードに進化を適用
        if (deckCard.id.split('_evo')[0] === targetBaseID) {
            // ALL_CARDSのapplyEvolution関数で進化ロジックを適用 (cards.jsで定義)
            // NOTE: applyEvolutionはカードをインプレイスで変更する想定
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
    
    // 3. 進化候補から選択されたカードを削除し、新しい候補を提示する (簡易化のため再抽選はしない)
    gameState.evolutionPhase.candidates = gameState.evolutionPhase.candidates.filter(c => c.id !== card.id);
    
    if (gameState.evolutionPhase.count === 0) {
        // 進化フェーズ終了
        endEvolutionPhase();
    } else {
        renderEvolutionChoices(); // 残りの候補を表示
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
    saveHighScore(); // ハイスコアを保存
    
    document.getElementById('final-stage').textContent = finalStage;
    document.getElementById('high-score').textContent = gameState.highScore;

    // ゲームオーバー後の再スタートはタイトル画面へ
    document.getElementById('restart-button').onclick = showTitleScreen;
}


// --- 🌟 画面切り替え ---

function showScreen(screenElement) {
    // 全ての主要画面を非表示にする
    [$titleScreen, $deckSelectScreen, $deckManagementScreen, $gameContainer, $overlay].forEach(el => {
        el.classList.add('hidden');
    });
    // 指定された画面を表示
    screenElement.classList.remove('hidden');
}

function showTitleScreen() {
    showScreen($titleScreen);
}

function showDeckSelectScreen() {
    renderDeckSelect();
    showScreen($deckSelectScreen);
}

function showDeckManagementScreen() {
    renderDeckManagement();
    showScreen($deckManagementScreen);
}

function showGameScreen() {
    // ゲームに必要な情報（スコアやデッキ）を初期化してから表示
    showScreen($gameContainer);
    startGame();
}


// --- 🌟 デッキ選択画面の描画 ---

function renderDeckSelect() {
    $deckListSelect.innerHTML = '';
    playerDecks.forEach((deck, index) => {
        const deckItem = document.createElement('div');
        deckItem.className = 'deck-item';
        const totalCards = deck.cards.reduce((sum, c) => sum + c.count, 0);
        deckItem.innerHTML = `
            <input type="radio" name="selectedDeck" id="deck-${index}" value="${index}" ${index === selectedDeckIndex ? 'checked' : ''}>
            <label for="deck-${index}">${deck.name} (${totalCards}枚)</label>
        `;
        $deckListSelect.appendChild(deckItem);
    });
}


// --- 🌟 デッキ管理画面の描画と操作 ---

function renderDeckManagement() {
    $deckListManagement.innerHTML = '';
    playerDecks.forEach((deck, index) => {
        const deckItem = document.createElement('div');
        deckItem.className = 'deck-item';
        const totalCards = deck.cards.reduce((sum, c) => sum + c.count, 0);
        deckItem.innerHTML = `
            <span>${deck.name} (${totalCards}枚)</span>
            <div>
                <button onclick="renameDeck(${index})">名前変更</button>
                <button onclick="copyDeck(${index})">コピー</button>
                <button onclick="deleteDeck(${index})" ${playerDecks.length === 1 ? 'disabled' : ''}>削除</button>
            </div>
        `;
        $deckListManagement.appendChild(deckItem);
    });
}

function renameDeck(index) {
    const newName = prompt(`「${playerDecks[index].name}」の新しい名前を入力してください:`, playerDecks[index].name);
    if (newName && newName.trim() !== "") {
        playerDecks[index].name = newName.trim();
        saveDeckData();
        renderDeckManagement();
        if (selectedDeckIndex === index) renderDeckSelect(); // 選択画面の表示も更新
    }
}

function copyDeck(index) {
    const originalDeck = playerDecks[index];
    const newDeck = JSON.parse(JSON.stringify(originalDeck)); // ディープコピー
    newDeck.name = originalDeck.name + ' (コピー)';
    playerDecks.push(newDeck);
    saveDeckData();
    renderDeckManagement();
    renderDeckSelect(); // 選択画面の表示も更新
    alert(`「${originalDeck.name}」をコピーして「${newDeck.name}」を作成しました。`);
}

function deleteDeck(index) {
    if (playerDecks.length > 1 && confirm(`デッキ「${playerDecks[index].name}」を削除しますか？`)) {
        playerDecks.splice(index, 1);
        saveDeckData();
        // 削除により選択中のインデックスがずれる可能性を考慮
        if (selectedDeckIndex === index) {
            selectedDeckIndex = 0;
        } else if (selectedDeckIndex > index) {
            selectedDeckIndex--;
        }
        renderDeckManagement();
        renderDeckSelect(); // 選択画面の表示も更新
    }
}

function createNewDeck() {
    const newDeckName = prompt("新しいデッキの名前を入力してください:", "カスタムデッキ");
    if (newDeckName && newDeckName.trim() !== "") {
        // 初期デッキと同じカード構成のテンプレートを作成
        const newDeck = JSON.parse(JSON.stringify(INITIAL_DECK_TEMPLATE));
        newDeck.name = newDeckName.trim();
        playerDecks.push(newDeck);
        saveDeckData();
        renderDeckManagement();
        renderDeckSelect();
        alert(`デッキ「${newDeck.name}」を作成しました。（初期デッキと同じカード構成です）`);
    }
}


// --- 🌟 イベントリスナーの追加 ---
$endTurnButton.addEventListener('click', endTurn);

// タイトル画面
document.getElementById('start-game-button').addEventListener('click', showDeckSelectScreen);
document.getElementById('manage-deck-button').addEventListener('click', showDeckManagementScreen);

// デッキ選択画面
document.getElementById('back-to-title-button-select').addEventListener('click', showTitleScreen);
document.getElementById('confirm-deck-button').addEventListener('click', () => {
    // 選択されたラジオボタンの値を取得
    const selectedRadio = document.querySelector('input[name="selectedDeck"]:checked');
    if (selectedRadio) {
        selectedDeckIndex = parseInt(selectedRadio.value);
        showGameScreen();
    } else {
        alert('使用するデッキを選択してください。');
    }
});

// デッキ管理画面
document.getElementById('back-to-title-button-manage').addEventListener('click', showTitleScreen);
document.getElementById('new-deck-button').addEventListener('click', createNewDeck);


// --- ゲーム開始（タイトル画面から呼ばれる） ---
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
    
    // 選択されたデッキを構築
    setupInitialDeck();
    
    // ターン開始
    startTurn();
    updateDisplay();
}

// 初回起動: データをロードしてタイトル画面へ
loadDeckData();
showTitleScreen();