// deckManager.js

// 必要な関数とデータをインポート
import {
    generateEffectText,
    generateFullEffectText,
    ALL_CARDS,
    getCardEffectData,
    getCardMaxEvolution
} from './cards.js';
// showDeckManagementScreenはmain.jsでの画面制御のため使用しないが、既存のimportは残しておく
import { showDeckManagementScreen } from './main.js';

// --- データのキーと初期データ ---
const STORAGE_KEY_DECKS = 'roguelite_decks';
const MAX_DECK_SIZE = 20; // デッキの最大枚数

export const INITIAL_DECK_TEMPLATE = {
    name: "初心者デッキ",
    cards: [
        { id: 'score_1', count: 8 },         // 8枚 (基本点)
        { id: 'score_2', count: 4 },         // 4枚 (加速点)
        { id: 'new_score_3', count: 2 },     // 2枚 (新規: 集中点 - Score/PurgeSelf)
        { id: 'new_draw_low', count: 2 },    // 2枚 (新規: 調査 - Score/Draw/DiscardHand)
        { id: 'combo_x2', count: 2 },        // 2枚 (倍率)
        { id: 'combo_ignore', count: 1 },    // 1枚 (コスト無視)
        { id: 'new_max_use_add', count: 1 }, // 1枚 (新規: 機動 - CardUseMod)
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
// 🌟 追加: 保存ボタンのDOM要素を取得
const $saveDeckButton = document.getElementById('save-deck-button');


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

// 🌟 新規: デッキ編集画面のUI (特に枚数表示と保存ボタン) を更新する関数
function updateDeckEditUI() {
    const currentTotalSize = tempDeck.reduce((sum, card) => sum + card.count, 0);

    // 1. 枚数表示の更新と色分け
    let sizeClass = 'size-short';
    if (currentTotalSize === MAX_DECK_SIZE) {
        sizeClass = 'size-ok';
    } else if (currentTotalSize > MAX_DECK_SIZE) {
        sizeClass = 'size-over';
    }

    $currentDeckSize.innerHTML = `現在の枚数: <span class="${sizeClass}">${currentTotalSize}</span> / ${MAX_DECK_SIZE} 枚`;

    // 2. 保存ボタンの活性化/非活性化
    // 🌟 デッキ枚数が20枚のときのみ保存可能にする
    if ($saveDeckButton) {
        $saveDeckButton.disabled = currentTotalSize !== MAX_DECK_SIZE;
    }
}


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
export function renderCardEditList() {
    // DOM要素はグローバルスコープで取得済みなので再取得は不要
    $cardEditList.innerHTML = '';

    // 🌟 修正: 合計枚数表示と保存ボタンの活性化は updateDeckEditUI() に移動

    // ALL_CARDSをループして、全カードの情報を表示
    ALL_CARDS.forEach(cardInfo => {
        const cardId = cardInfo.id;
        const currentCount = tempDeck.find(c => c.id === cardId)?.count || 0;

        // 🌟 カードごとの最大レベルを取得 (base: 0, 1, 2... に対応)
        const maxEvo = getCardMaxEvolution(cardInfo);
        const maxDisplayLevel = maxEvo + 1; // Lv.1, Lv.2, Lv.3...
        const currentLevel = 0; // デッキ編集画面では常に初期レベル(0)を基準に表示

        // ------------------------------------
        // 現在のレベルの効果 (Lv.1)
        const currentEffectText = generateFullEffectText(cardInfo, currentLevel);
        const currentLevelDisplay = `<span class="current-level">Lv.1：${currentEffectText}</span>`;

        // 次のレベルの効果 (Lv.2, Lv.3... または MAX)
        let nextLevelDisplay = '';
        if (currentLevel < maxEvo) {
            const nextLevel = currentLevel + 1; // Lv.2 (インデックス1)
            const nextEffectData = getCardEffectData(cardInfo, nextLevel);

            let nextEffectDescription = nextEffectData.map(effect => {
                // descriptionの{value}を実際の値に置き換える
                return effect.description.replace(/\{\w+\}/, effect.value);
            }).join(' / ');

            // 🌟 次のレベルの恩恵を表示
            nextLevelDisplay = `<p class="card-next-effect">→ Lv.${nextLevel + 1}：${nextEffectDescription}</p>`;
        } else {
            // 🌟 MAX表示
            nextLevelDisplay = `<p class="card-next-effect max-level">MAX LEVEL (Lv.${maxDisplayLevel}でカンスト)</p>`;
        }
        // ------------------------------------

        const cardItem = document.createElement('div');
        cardItem.className = 'edit-card-item';

        cardItem.innerHTML = `
            <div class="card-info-group">
                <div class="card-name">${cardInfo.name} (${cardInfo.type}) <span class="card-max-level">(Max Lv.${maxDisplayLevel})</span></div>
                <p class="card-effect">${currentLevelDisplay}</p>
                ${nextLevelDisplay} </div>
            <div class="edit-controls">
                <button data-action="decrease-card" data-cardid="${cardId}" ${currentCount <= 0 ? 'disabled' : ''}>-</button>
                <span class="card-count" data-cardid="${cardId}">${currentCount}枚</span>
                <button data-action="increase-card" data-cardid="${cardId}">+</button>
            </div>
        `;
        $cardEditList.appendChild(cardItem);
    });

    // 🌟 追加: UIの状態を更新 (枚数表示と保存ボタンの制御)
    updateDeckEditUI();
}

/**
 * カードの枚数を変更する
 * @param {string} cardId - 変更対象のカードID
 * @param {number} change - 変更量 (+1 または -1)
 */
export function changeCardCount(cardId, change) {

    // 1. 該当するカードエントリを探す（存在しない場合はnull）
    let cardEntry = tempDeck.find(c => c.id === cardId);

    if (!cardEntry) {
        // デッキにカードがない場合、新規作成
        if (change > 0) {
            // 🌟 処理: 新規カードは追加する
            tempDeck.push({ id: cardId, count: 1 });
        }
        // change <= 0 の場合は何もしない
    } else {
        // 2. 枚数を変更
        cardEntry.count += change;

        // 3. 枚数が0以下になった場合
        if (cardEntry.count <= 0) {
            // 🌟 処理: 該当カードをtempDeckから除去し、tempDeckを新しい配列で上書きする
            tempDeck = tempDeck.filter(c => c.id !== cardId);
            // 削除後、枚数が0以下になったカードのエントリが消えるため、cardEntryは参照できなくなるが、関数を抜けるため問題なし
        }
    }

    // 4. 再描画
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
        alert(`デッキの枚数は ${MAX_DECK_SIZE} 枚である必要があります。現在 ${currentTotalSize} 枚です。`);
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