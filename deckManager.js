// deckManager.js

// 必要な関数とデータをインポート
import { generateEffectText, ALL_CARDS } from './cards.js';
// showDeckManagementScreenはmain.jsでの画面制御のため使用しないが、既存のimportは残しておく
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

/**
 * ローカルストレージからデッキデータをロードする
 */
export function loadDeckData() {
    const data = localStorage.getItem(STORAGE_KEY_DECKS);
    if (data) {
        playerDecks = JSON.parse(data);
    } else {
        // データがない場合は初期デッキを作成
        playerDecks.push(JSON.parse(JSON.stringify(INITIAL_DECK_TEMPLATE)));
        playerDecks.push(JSON.parse(JSON.stringify(INITIAL_DECK_TEMPLATE))); // 2つ目も作成
        saveDecks();
    }
}

/**
 * デッキデータをローカルストレージに保存する
 */
function saveDecks() {
    localStorage.setItem(STORAGE_KEY_DECKS, JSON.stringify(playerDecks));
}


// --- 外部からアクセスするためのゲッター ---

export function getPlayerDecks() {
    return playerDecks;
}

export function getSelectedDeck() {
    return playerDecks[selectedDeckIndex];
}

export function setSelectedDeckIndex(index) {
    selectedDeckIndex = index;
}


// --- デッキ選択画面の描画 ---

/**
 * デッキ選択リストをレンダリングする
 */
export function renderDeckSelect() {
    $deckListSelect.innerHTML = '';

    playerDecks.forEach((deck, index) => {
        const totalSize = deck.cards.reduce((sum, card) => sum + card.count, 0);

        const deckItem = document.createElement('div');
        deckItem.className = 'deck-item deck-select-item'; // 選択画面専用のクラスを追加

        // 🌟 修正: ラジオボタンとテキストを<label>で囲み、クリック可能範囲を広げる
        deckItem.innerHTML = `
            <label for="deck-${index}-select">
                <input type="radio" id="deck-${index}-select" name="selected-deck" value="${index}" ${index === selectedDeckIndex ? 'checked' : ''}>
                <span class="deck-name-display">${deck.name} (${totalSize}枚)</span>
            </label>
        `;
        $deckListSelect.appendChild(deckItem);
    });

    // 🌟 修正: ラジオボタンの変更イベントはmain.jsで一元管理するため、ここでは設定を削除します。
    // main.jsでボタンの活性化と選択インデックスの更新を行います。
}


// --- デッキ管理画面の描画と操作 ---

/**
 * デッキ管理リストをレンダリングする
 */
export function renderDeckManagement() {
    $deckListManagement.innerHTML = '';

    playerDecks.forEach((deck, index) => {
        const totalSize = deck.cards.reduce((sum, card) => sum + card.count, 0);

        const deckItem = document.createElement('div');
        deckItem.className = 'deck-item';
        // data-indexとdata-action属性で、main.js側でイベントをハンドルする
        deckItem.innerHTML = `
            <div>
                <span class="deck-name-display">${deck.name} (${totalSize}枚)</span>
            </div>
            <div class="deck-actions">
                <button data-action="edit" data-index="${index}">編集</button>
                <button data-action="copy" data-index="${index}">複製</button>
                <button data-action="delete" data-index="${index}">削除</button>
            </div>
        `;
        $deckListManagement.appendChild(deckItem);
    });
}

/**
 * 新規デッキを作成する
 */
export function createNewDeck() {
    const newDeck = JSON.parse(JSON.stringify(INITIAL_DECK_TEMPLATE));
    newDeck.name = `新規デッキ ${playerDecks.length + 1}`;
    playerDecks.push(newDeck);
    saveDecks();
    renderDeckManagement();

    // 新規作成したデッキの編集画面を開く
    editDeck(playerDecks.length - 1);
}

/**
 * 既存デッキをコピーする
 * @param {number} index - コピー元のデッキのインデックス
 */
export function copyDeck(index) {
    const copiedDeck = JSON.parse(JSON.stringify(playerDecks[index]));
    copiedDeck.name = `${copiedDeck.name} のコピー`;
    playerDecks.push(copiedDeck);
    saveDecks();
    renderDeckManagement();
}

/**
 * デッキを削除する
 * @param {number} index - 削除するデッキのインデックス
 */
export function deleteDeck(index) {
    if (playerDecks.length <= 1) {
        alert("デッキは最低1つ必要です。");
        return;
    }
    if (confirm(`${playerDecks[index].name} を削除しますか？`)) {
        playerDecks.splice(index, 1);
        // 選択中のデッキが削除された場合、インデックスを調整
        if (selectedDeckIndex === index) {
            selectedDeckIndex = 0;
        } else if (selectedDeckIndex > index) {
            selectedDeckIndex--;
        }
        saveDecks();
        renderDeckManagement();
        // デッキ選択画面もリフレッシュ (選択中のデッキが変わる可能性があるため)
        renderDeckSelect();
    }
}


// --- デッキ編集画面の操作 ---

/**
 * デッキ編集画面を開く
 * @param {number} index - 編集するデッキのインデックス
 */
export function editDeck(index) {
    if (index < 0 || index >= playerDecks.length) return;

    editingDeckIndex = index;
    // 編集用の一時データを作成 (ディープコピー)
    tempDeck = JSON.parse(JSON.stringify(playerDecks[index].cards));

    $editDeckName.value = playerDecks[index].name;
    $deckEditOverlay.classList.remove('hidden');

    renderCardEditList();
}

/**
 * カード編集リストをレンダリングする
 */
function renderCardEditList() {
    $cardEditList.innerHTML = '';

    // 全カードリストをベースに描画
    ALL_CARDS.forEach(cardData => {
        const cardEntry = tempDeck.find(c => c.id === cardData.id);
        const count = cardEntry ? cardEntry.count : 0;

        const listItem = document.createElement('div');
        listItem.className = 'card-edit-item';

        const effectHtml = generateEffectText(cardData); // cards.jsの関数

        // data-action属性で、main.js側でイベントをハンドルする
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

    // 🌟 修正点1: 合計枚数がMAX_DECK_SIZEを超えた場合にクラスを適用する
    const deckSizeClass = currentTotalSize > MAX_DECK_SIZE ? 'size-over' : (currentTotalSize === MAX_DECK_SIZE ? 'size-ok' : 'size-short');
    $currentDeckSize.innerHTML = `合計: <span class="${deckSizeClass}">${currentTotalSize}</span> / ${MAX_DECK_SIZE}`;

    // 保存ボタンの活性/非活性を制御
    // 🌟 修正点2: 枚数がMAX_DECK_SIZEと一致しない場合は無効化（オーバー時も含む）
    document.getElementById('save-deck-button').disabled = currentTotalSize !== MAX_DECK_SIZE;
}

/**
 * カードの枚数を変更する
 * @param {string} cardId - 変更対象のカードID
 * @param {number} change - 変更量 (+1 または -1)
 */
export function changeCardCount(cardId, change) {

    // 🌟 修正点3: 最大枚数チェック (MAX_DECK_SIZE) を削除し、制限なく追加できるようにする

    if (change < 0 && (tempDeck.find(c => c.id === cardId)?.count || 0) <= 0) {
        return; // 0枚以下の場合は減らさない
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
    // 🌟 修正点4: 保存時は引き続き厳密にMAX_DECK_SIZEであることを要求する
    if (currentTotalSize !== MAX_DECK_SIZE) {
        alert(`デッキの枚数は ${MAX_DECK_SIZE} 枚である必要があります。`);
        return;
    }

    // データの更新
    playerDecks[editingDeckIndex].name = $editDeckName.value.trim() || `名称未設定デッキ ${editingDeckIndex + 1}`;
    // countが0のカードを除去してから保存
    playerDecks[editingDeckIndex].cards = tempDeck.filter(c => c.count > 0);

    saveDecks();
    closeEditScreen();

    // デッキ管理画面とデッキ選択画面を再描画
    renderDeckManagement();
    renderDeckSelect();
}

/**
 * デッキ編集画面を閉じる
 */
export function closeEditScreen() {
    $deckEditOverlay.classList.add('hidden');
    editingDeckIndex = -1;
    tempDeck = [];
}