// deckManager.js

// 必要な関数とデータをインポート
import { generateEffectText, ALL_CARDS } from './cards.js';
import { showDeckManagementScreen } from './main.js';

// --- データのキーと初期データ ---
const STORAGE_KEY_DECKS = 'roguelite_decks';
const MAX_DECK_SIZE = 20; // デッキの最大枚数

const INITIAL_DECK_TEMPLATE = {
    name: "初期デッキ",
    cards: [
        { id: 'score_1', count: 10 },
        { id: 'score_2', count: 5 },
        { id: 'combo_x2', count: 3 },
        { id: 'combo_ignore', count: 2 },
    ]
};

// 状態管理
let playerDecks = [];
let selectedDeckIndex = 0;
let editingDeckIndex = -1; // 現在編集中のデッキのインデックス
let tempDeck = [];         // 編集作業用の一時的なデッキデータ (カードの枚数データ)

// --- DOM要素の取得 ---
const $deckListSelect = document.getElementById('deck-list-select');
const $deckListManagement = document.getElementById('deck-list-management');
const $deckEditOverlay = document.getElementById('deck-edit-overlay');
const $editDeckName = document.getElementById('edit-deck-name');
const $currentDeckSize = document.getElementById('current-deck-size');
const $cardEditList = document.getElementById('card-edit-list');


// --- デッキデータのロード/保存 ---

/** デッキデータをロードする */
export function loadDeckData() {
    const storedDecks = localStorage.getItem(STORAGE_KEY_DECKS);

    if (storedDecks) {
        playerDecks = JSON.parse(storedDecks);
    } else {
        // データがない場合は初期デッキを作成
        playerDecks.push(INITIAL_DECK_TEMPLATE);
        saveDecks();
    }
}

/** デッキデータを保存する */
function saveDecks() {
    localStorage.setItem(STORAGE_KEY_DECKS, JSON.stringify(playerDecks));
}


// --- 外部からアクセスするためのゲッター ---

/** すべてのデッキデータを取得する */
export function getPlayerDecks() {
    return playerDecks;
}

/** 選択されているデッキデータを取得する */
export function getSelectedDeck() {
    return playerDecks[selectedDeckIndex];
}

/** 選択されているデッキのインデックスを設定する */
export function setSelectedDeckIndex(index) {
    selectedDeckIndex = index;
}


// --- デッキ選択画面の描画 ---

/** デッキ選択リストをレンダリングする */
export function renderDeckSelect() {
    $deckListSelect.innerHTML = '';
    playerDecks.forEach((deck, index) => {
        const deckItem = document.createElement('label');
        deckItem.className = 'deck-item';
        deckItem.innerHTML = `
            <input type="radio" name="selectedDeck" value="${index}" ${index === selectedDeckIndex ? 'checked' : ''}>
            <span>${deck.name} (${deck.cards.reduce((sum, card) => sum + card.count, 0)}枚)</span>
        `;
        $deckListSelect.appendChild(deckItem);
    });
}


// --- デッキ管理画面の描画と操作 ---

/** デッキ管理リストをレンダリングする */
export function renderDeckManagement() {
    $deckListManagement.innerHTML = '';
    playerDecks.forEach((deck, index) => {
        const deckItem = document.createElement('div');
        deckItem.className = 'deck-item';
        // 🌟 修正: onclick属性を削除し、データ属性を使用してイベントリスナーをmain.jsで一括処理する
        deckItem.innerHTML = `
            <span>${deck.name} (${deck.cards.reduce((sum, card) => sum + card.count, 0)}枚)</span>
            <div>
                <button data-action="edit" data-index="${index}">編集</button>
                <button data-action="copy" data-index="${index}">コピー</button>
                <button data-action="delete" data-index="${index}" ${playerDecks.length === 1 ? 'disabled' : ''}>削除</button>
            </div>
        `;
        $deckListManagement.appendChild(deckItem);
    });
}

/**
 * 新しいデッキを作成し、編集画面を開く
 */
export function createNewDeck() {
    // デフォルトの初期デッキのコピーを作成
    const newDeck = JSON.parse(JSON.stringify(INITIAL_DECK_TEMPLATE));
    newDeck.name = `新しいデッキ ${playerDecks.length + 1}`;

    playerDecks.push(newDeck);
    saveDecks();

    // 作成したデッキの編集画面を開く
    editDeck(playerDecks.length - 1);
    renderDeckManagement();
}

/**
 * デッキをコピーする (エクスポート関数)
 * @param {number} index - コピーするデッキのインデックス
 */
export function copyDeck(index) {
    const originalDeck = playerDecks[index];
    const newDeck = JSON.parse(JSON.stringify(originalDeck));

    // デッキ名を「(元のデッキ名) のコピー」とする
    newDeck.name = `${originalDeck.name} のコピー`;

    // コピーを元のデッキの直後に追加
    playerDecks.splice(index + 1, 0, newDeck);
    saveDecks();
    renderDeckManagement();
    alert(`「${newDeck.name}」を作成しました。`);
}

/**
 * デッキを削除する (エクスポート関数)
 * @param {number} index - 削除するデッキのインデックス
 */
export function deleteDeck(index) { // 🌟 修正: window.deleteDeck から export function deleteDeck に変更
    if (playerDecks.length <= 1) {
        alert("デッキは最低1つ必要です。");
        return;
    }
    if (confirm(`${playerDecks[index].name} を削除してもよろしいですか？`)) {
        playerDecks.splice(index, 1);
        saveDecks();
        if (selectedDeckIndex === index) {
            selectedDeckIndex = 0; // 選択中のデッキが削除されたらデフォルトに戻す
        } else if (selectedDeckIndex > index) {
            selectedDeckIndex--; // インデックスのずれを修正
        }
        renderDeckManagement();
    }
}

// --- デッキ編集画面の操作 ---

/**
 * デッキ編集画面を開く (エクスポート関数)
 * @param {number} index - 編集するデッキのインデックス
 */
export function editDeck(index) { // 🌟 修正: window.editDeck から export function editDeck に変更
    editingDeckIndex = index;
    // 編集用の一時データを作成 (ディープコピー)
    tempDeck = JSON.parse(JSON.stringify(playerDecks[index].cards));

    $editDeckName.value = playerDecks[index].name;
    $deckEditOverlay.classList.remove('hidden');

    renderCardEditList();
    // showDeckManagementScreen(); // 🌟 削除: main.jsで画面制御を行うため
}

/**
 * カード編集リストをレンダリングする
 */
function renderCardEditList() {
    $cardEditList.innerHTML = '';

    // ... (カードリストの描画ロジックは変更なし)

    // 全カードリストをベースに描画
    ALL_CARDS.forEach(cardData => {
        const cardEntry = tempDeck.find(c => c.id === cardData.id);
        const count = cardEntry ? cardEntry.count : 0;

        const listItem = document.createElement('div');
        listItem.className = 'card-edit-item';

        const effectHtml = generateEffectText(cardData); // cards.jsの関数

        // 🌟 修正: onclick属性をデータ属性ベースに変更 (main.jsでイベントリスナーを登録する)
        listItem.innerHTML = `
            <div class="card-info">
                <div class="card-title">${cardData.name}</div>
                ${effectHtml}
            </div>
            <div class="card-controls">
                <button data-action="decrease-card" data-cardid="${cardData.id}" ${count <= 0 ? 'disabled' : ''}>-</button>
                <span class="card-count">${count}</span>
                <button data-action="increase-card" data-cardid="${cardData.id}">+</button>
            </div>
        `;
        $cardEditList.appendChild(listItem);
    });

    // 現在の合計枚数を更新
    const currentTotalSize = tempDeck.reduce((sum, card) => sum + card.count, 0);
    $currentDeckSize.textContent = `${currentTotalSize} / ${MAX_DECK_SIZE}`;

    // 保存ボタンの活性/非活性を制御
    document.getElementById('save-deck-button').disabled = currentTotalSize !== MAX_DECK_SIZE;
}

/**
 * カードの枚数を変更する (エクスポート関数)
 * @param {string} cardId - 変更対象のカードID
 * @param {number} change - 変更量 (+1 または -1)
 */
export function changeCardCount(cardId, change) { // 🌟 修正: window.changeCardCount から export function changeCardCount に変更
    const currentTotalSize = tempDeck.reduce((sum, card) => sum + card.count, 0);

    if (change > 0 && currentTotalSize >= MAX_DECK_SIZE) {
        alert(`デッキの枚数は ${MAX_DECK_SIZE} 枚までです。`);
        return;
    }

    let cardEntry = tempDeck.find(c => c.id === cardId);

    if (!cardEntry) {
        // デッキにカードがない場合、新規作成
        if (change > 0) {
            tempDeck.push({ id: cardId, count: 1 });
        }
    } else {
        cardEntry.count += change;

        // 枚数が0になったら配列から削除
        if (cardEntry.count <= 0) {
            tempDeck = tempDeck.filter(c => c.id !== cardId);
        }
    }

    renderCardEditList();
}

/**
 * デッキの変更内容を保存する
 */
export function saveDeckChanges() {
    if (editingDeckIndex === -1) return;

    const currentTotalSize = tempDeck.reduce((sum, card) => sum + card.count, 0);
    if (currentTotalSize !== MAX_DECK_SIZE) {
        alert(`デッキの枚数は ${MAX_DECK_SIZE} 枚である必要があります。`);
        return;
    }

    // データの更新
    // 🌟 修正: inputタグから値を取得する
    playerDecks[editingDeckIndex].name = $editDeckName.value.trim() || `名称未設定デッキ ${editingDeckIndex + 1}`;
    // countが0のカードを削除して保存
    playerDecks[editingDeckIndex].cards = tempDeck.filter(c => c.count > 0);

    saveDecks();
    closeEditScreen();
    renderDeckManagement();

    alert("デッキが保存されました。");
}

/**
 * デッキ編集画面を閉じる
 */
export function closeEditScreen() {
    editingDeckIndex = -1;
    tempDeck = [];
    $deckEditOverlay.classList.add('hidden');
    // デッキ管理画面に戻る
    document.getElementById('deck-management-screen').classList.remove('hidden');
}