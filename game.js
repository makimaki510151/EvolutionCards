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
        { id: 'combo_ignore', count: 2 },
    ]
};

let playerDecks = [];
let selectedDeckIndex = 0;

// 🌟 デッキ編集用の状態
let editingDeckIndex = -1; // 現在編集中のデッキのインデックス
let tempDeck = [];         // 編集作業用の一時的なデッキデータ (カードの枚数データ)


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

// 🌟 追加 DOM要素 (画面切り替え・デッキ管理)
const $titleScreen = document.getElementById('title-screen');
const $deckSelectScreen = document.getElementById('deck-select-screen');
const $deckManagementScreen = document.getElementById('deck-management-screen');
const $gameContainer = document.getElementById('game-container');
const $deckListSelect = document.getElementById('deck-list-select');
const $deckListManagement = document.getElementById('deck-list-management');

// 🌟 追加 DOM要素 (デッキ編集画面)
const $deckEditOverlay = document.getElementById('deck-edit-overlay');
const $editDeckName = document.getElementById('edit-deck-name');
const $currentDeckSize = document.getElementById('current-deck-size');
const $cardEditList = document.getElementById('card-edit-list');
const $saveDeckButton = document.getElementById('save-deck-button');
const $cancelEditButton = document.getElementById('cancel-edit-button');


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
                // 🌟 baseEvolutionを初期レベルとしてコピー
                initialDeck.push({...baseCard, evolution: baseCard.baseEvolution || 0}); 
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
                    initialDeck.push({...baseCard, evolution: baseCard.baseEvolution || 0});
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
    
    // 🌟 統一された効果テキストを生成 (cards.js の関数を使用)
    const effectHtml = generateEffectText(card);
    
    cardEl.innerHTML = `
        <div class="card-title">${card.name}</div>
        ${effectHtml}
    `;
    cardEl.dataset.id = card.id;
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
    if (cardIndex === -1) return; 

    const currentLevel = card.evolution || 0;
    let uses = 1; // 使用枚数制限を消費する量
    let isCostIgnored = false;

    // 🌟 コスト無視効果の事前判定 (簡易化のため、ここではカードタイプCostの1番目の効果のみを判定)
    const costEffect = card.effects.find(e => e.type === 'CostIgnore');
    if (costEffect) {
        const ignoreCount = costEffect.params.ignoreCount[Math.min(currentLevel, costEffect.params.ignoreCount.length - 1)];
        // 最初のCostIgnore効果のみを判定に使う（ここでは常に1枚目を無視する効果を想定）
        if (ignoreCount > 0) {
            uses = 0; // コスト消費なし
            isCostIgnored = true;
        }
    }

    if (uses > 0 && gameState.cardsUsedThisTurn >= gameState.maxCardUses) {
        alert('今ターンはもうカードを使用できません。');
        return;
    }

    // 🌟 【2】複数カード効果の適用
    card.effects.forEach(effect => {
        const valueKey = Object.keys(effect.params)[0];
        const value = effect.params[valueKey][Math.min(currentLevel, effect.params[valueKey].length - 1)];

        if (value === 0 && effect.type !== 'CostIgnore') return; // 値が0の効果はスキップ

        switch (effect.type) {
            case 'Score':
                // スコア倍率（ここでは未実装のバフ状態）を適用
                gameState.currentScore += value * 1; 
                break;
            case 'Draw':
                drawCard(value);
                break;
            case 'Multiplier':
                alert(`バフ発動: 次のカードの効果が${value}倍になります！`);
                // TODO: gameStateにバフ状態を保存するロジックを実装
                break;
            case 'CostIgnore':
                if (isCostIgnored) alert(`コスト無視効果発動: 次の${value}枚のカードがコスト無視になります！`);
                break;
        }
    });

    // 【3】カードの移動と使用回数更新
    if (uses > 0) {
        gameState.cardsUsedThisTurn += uses;
    }
    
    // カードを手札から捨て札へ
    gameState.hand.splice(cardIndex, 1);
    gameState.discard.push(card);
    
    renderHand();
    checkStageCompletion(); 
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
        const uniqueCards = [...new Set(allCards.map(c => c.id.split('_evo')[0]))].map(baseId => {
            // ALL_CARDSから元のカード定義を取得し、進化レベルが最も高いものを候補とする（簡易化）
            const bestCard = allCards.find(c => c.id.split('_evo')[0] === baseId) || ALL_CARDS.find(c => c.id === baseId);
            return {...bestCard};
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

    // 1. デッキ内の同じカード（同じIDのベース部分）を検索し、進化を適用
    const targetBaseID = card.id.split('_evo')[0]; 

    // 全てのカードプール（デッキ、捨て札、手札）をチェック
    const allCards = [...gameState.deck, ...gameState.discard, ...gameState.hand];
    
    let evolvedCount = 0;
    
    // 進化対象のカードIDは、進化レベルが最も高いカードのIDを基準にする
    const cardToEvolve = allCards.find(c => c.id.split('_evo')[0] === targetBaseID);
    if (!cardToEvolve) return alert("エラー: デッキ内に進化対象のカードが見つかりませんでした。");

    // cards.jsのapplyEvolutionを呼び出し、進化後の情報を取得
    const newEvolvedCardData = applyEvolution({...cardToEvolve});
    if (cardToEvolve.evolution === newEvolvedCardData.evolution) {
        alert(`${cardToEvolve.name} は既に最大レベルです。`);
        return;
    }
    
    // 元のIDを持つ全てのカードを進化後のデータに置き換える
    for (let i = 0; i < allCards.length; i++) {
        const deckCard = allCards[i];
        if (deckCard.id.split('_evo')[0] === targetBaseID) {
            // 進化後のカードデータに更新
            Object.assign(deckCard, newEvolvedCardData); 
            evolvedCount++;
        }
    }

    // 2. 進化回数を減らし、UIを更新
    gameState.evolutionPhase.count--;
    document.getElementById('evo-count').textContent = gameState.evolutionPhase.count;
    
    // 3. 進化候補から選択されたカードを削除
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
    // 全ての主要画面とオーバーレイを非表示にする
    [$titleScreen, $deckSelectScreen, $deckManagementScreen, $gameContainer, $overlay, $deckEditOverlay].forEach(el => {
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
                <button onclick="editDeck(${index})">編集</button>
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

// --- 🌟 デッキ編集機能のロジック ---

/** デッキ編集画面を表示する */
function editDeck(index) {
    editingDeckIndex = index;
    const originalDeck = playerDecks[index];
    
    // 編集用のデータを作成（ALL_CARDSの全種類をベースに、既存の枚数を反映）
    tempDeck = ALL_CARDS.map(baseCard => {
        const existingCard = originalDeck.cards.find(c => c.id === baseCard.id);
        return {
            id: baseCard.id,
            name: baseCard.name,
            count: existingCard ? existingCard.count : 0
        };
    });

    $editDeckName.textContent = `デッキ名: ${originalDeck.name}`;
    $deckEditOverlay.classList.remove('hidden');
    renderCardEditList();
}

/** カード編集リストの描画 (進化情報表示を追加) */
function renderCardEditList() {
    $cardEditList.innerHTML = '';
    let currentTotalSize = 0;
    const MAX_LEVEL = 2; // cards.jsに合わせた最大レベル

    tempDeck.forEach((card, index) => {
        currentTotalSize += card.count;
        
        // 🌟 ALL_CARDSから現在のカードの完全な定義を取得
        const baseCardDefinition = ALL_CARDS.find(c => c.id === card.id);
        if (!baseCardDefinition) return; 

        // レベルごとの効果を比較表示するHTMLを生成
        let levelInfoHtml = '<div style="font-size: 0.8em; margin-top: 5px; color: #ccc;">';
        
        // 現在のレベルの効果（Lv.0として扱う）
        const currentEffects = generateEffectText(Object.assign({}, baseCardDefinition, { evolution: 0 })).replace(/<p class="card-effect">|<\/p>/g, '');
        levelInfoHtml += `**基本効果**: ${currentEffects}`;

        if (0 < MAX_LEVEL) {
             // 次のレベルの進化効果を表示 (Lv.1として扱う)
             const nextLevelEffects = generateEffectText(Object.assign({}, baseCardDefinition, { evolution: 1 })).replace(/<p class="card-effect">|<\/p>/g, '');
             levelInfoHtml += `<br>次の進化: <span style="color: #ffd700;">${nextLevelEffects.replace('Lv.1：', '')}</span>`;
        }
        levelInfoHtml += '</div>';

        
        const cardItem = document.createElement('div');
        cardItem.className = 'edit-card-item';
        
        cardItem.innerHTML = `
            <div style="flex-grow: 1;">
                <span>${card.name}</span>
                ${levelInfoHtml}
            </div>
            <div class="edit-controls">
                <button onclick="changeCardCount(${index}, -1)" ${card.count === 0 ? 'disabled' : ''}>-</button>
                <span class="card-count">${card.count}</span>
                <button onclick="changeCardCount(${index}, 1)">+</button>
            </div>
        `;
        $cardEditList.appendChild(cardItem);
    });

    $currentDeckSize.textContent = currentTotalSize;
    
    // 合計枚数が20枚の場合のみ保存を有効にする
    $saveDeckButton.disabled = currentTotalSize !== 20;
    
    // デッキサイズが20枚であることを強調表示
    $currentDeckSize.style.color = currentTotalSize === 20 ? '#3f3' : '#f33';
}

/** カードの枚数を増減させる */
function changeCardCount(index, delta) {
    const card = tempDeck[index];
    const currentTotalSize = tempDeck.reduce((sum, c) => sum + c.count, 0);

    // 減らす操作
    if (delta < 0) {
        if (card.count > 0) {
            card.count += delta;
        }
    } 
    // 増やす操作
    else if (delta > 0) {
        // 合計が20枚を超えないように制限
        if (currentTotalSize < 20) {
            card.count += delta;
        } else {
            alert("デッキの合計枚数は20枚までです。");
        }
    }
    
    renderCardEditList();
}

/** 変更を保存する */
function saveDeckChanges() {
    if (editingDeckIndex === -1) return;

    const currentTotalSize = tempDeck.reduce((sum, c) => sum + c.count, 0);
    if (currentTotalSize !== 20) {
        alert("デッキの合計枚数は20枚でなければ保存できません。");
        return;
    }

    // 編集後の一時データを playerDecks に反映
    const newCards = tempDeck
        .filter(c => c.count > 0) // 枚数が0のカードは除外
        .map(c => ({ id: c.id, count: c.count }));

    playerDecks[editingDeckIndex].cards = newCards;
    
    saveDeckData();
    closeEditScreen();
    alert(`デッキ「${playerDecks[editingDeckIndex].name}」の変更を保存しました。`);
}

/** 編集画面を閉じる */
function closeEditScreen() {
    $deckEditOverlay.classList.add('hidden');
    editingDeckIndex = -1;
    tempDeck = [];
    renderDeckManagement(); // デッキ管理画面を再描画して枚数を更新
    renderDeckSelect();     // デッキ選択画面も更新
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

// デッキ編集画面
$saveDeckButton.addEventListener('click', saveDeckChanges);
$cancelEditButton.addEventListener('click', closeEditScreen);


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