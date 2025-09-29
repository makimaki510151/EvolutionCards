// main.js

import {
    renderDeckSelect, renderDeckManagement, setSelectedDeckIndex, createNewDeck,
    saveDeckChanges, closeEditScreen, loadDeckData, editDeck, deleteDeck, copyDeck,
    changeCardCount // カード枚数変更関数もインポート
} from './deckManager.js';
import { startGame, endTurn } from './gameCore.js';

// 必要なモジュールとDOM要素をインポート/取得
const $titleScreen = document.getElementById('title-screen');
const $deckSelectScreen = document.getElementById('deck-select-screen');
const $deckManagementScreen = document.getElementById('deck-management-screen');
const $gameContainer = document.getElementById('game-container');
const $deckEditOverlay = document.getElementById('deck-edit-overlay');
const $confirmDeckButton = document.getElementById('confirm-deck-button');
const $startNewGameButton = document.getElementById('start-game-button');
const $manageDeckButton = document.getElementById('manage-deck-button');
const $cardEditList = document.getElementById('card-edit-list');
// 🌟 追加: デッキ選択リスト要素
const $deckListSelect = document.getElementById('deck-list-select');


// --- 画面切り替え ---

/** 画面全体を制御し、指定した画面を表示する */
export function showScreen(screenElement) {
    // 全ての主要画面とオーバーレイを非表示にする
    [$titleScreen, $deckSelectScreen, $deckManagementScreen, $gameContainer, $deckEditOverlay].forEach(el => {
        el.classList.add('hidden');
    });
    // 指定された画面を表示
    screenElement.classList.remove('hidden');
}

export function showTitleScreen() {
    showScreen($titleScreen);
}

export function showDeckSelectScreen() {
    renderDeckSelect(); // deckManager.jsの関数
    // 🌟 修正: デッキ選択画面表示時、「このデッキで開始」ボタンを常に活性化する
    $confirmDeckButton.disabled = false;
    showScreen($deckSelectScreen);
}

export function showDeckManagementScreen() {
    renderDeckManagement(); // deckManager.jsの関数
    showScreen($deckManagementScreen);
}

function showGameScreen() {
    // ゲームに必要な情報（スコアやデッキ）を初期化してから表示
    startGame(); // gameCore.jsの関数
    showScreen($gameContainer);
}


// --- イベントリスナーの追加 ---

function addGlobalEventListeners() {
    $startNewGameButton.addEventListener('click', showDeckSelectScreen); // showDeckSelectScreen は main.js 内で定義済み
    $manageDeckButton.addEventListener('click', () => {
        // デッキ管理画面に遷移する際、リストをレンダリングする
        showDeckManagementScreen();
    });

    // 🌟 デッキ選択画面のボタンとラジオボタンの処理を統合
    $confirmDeckButton.addEventListener('click', showGameScreen); // ゲーム開始ボタン
    document.getElementById('back-to-title-button-select').addEventListener('click', showTitleScreen);

    // 🌟 決定的な修正: デッキ選択ラジオボタンの変更イベント
    $deckListSelect.addEventListener('change', (e) => {
        const target = e.target;
        if (target.name === 'selected-deck' && target.type === 'radio') {
            const index = parseInt(target.value);
            setSelectedDeckIndex(index);
            // デッキが選択されたので、開始ボタンは押せる状態を維持（念のため）
            $confirmDeckButton.disabled = false;
        }
    });

    // デッキ管理画面
    document.getElementById('back-to-title-button-manage').addEventListener('click', showTitleScreen);
    document.getElementById('new-deck-button').addEventListener('click', createNewDeck);

    // 🌟 デッキ管理リストのボタンに対するイベントリスナー
    $deckManagementScreen.addEventListener('click', (e) => {
        const target = e.target;
        const action = target.dataset.action;
        const index = parseInt(target.dataset.index);

        if (action === 'edit') {
            editDeck(index);
        } else if (action === 'copy') {
            copyDeck(index);
        } else if (action === 'delete') {
            deleteDeck(index);
        }
    });

    // デッキ編集画面
    document.getElementById('save-deck-button').addEventListener('click', saveDeckChanges);
    document.getElementById('cancel-edit-button').addEventListener('click', closeEditScreen);

    // 🌟 カード編集リストのボタンに対するイベントリスナー
    $cardEditList.addEventListener('click', (e) => {
        const target = e.target;
        const action = target.dataset.action;
        const cardId = target.dataset.cardid;

        if (!cardId) return;

        if (action === 'increase-card') {
            changeCardCount(cardId, 1);
        } else if (action === 'decrease-card') {
            changeCardCount(cardId, -1);
        }
    });

    // ゲーム画面のターン終了ボタン
    document.getElementById('end-turn-button').addEventListener('click', endTurn);

    // ゲームオーバー画面のリスタートボタン
    document.getElementById('restart-button').onclick = showTitleScreen;
}

// --- 初期化処理 ---

// 🌟 決定的な修正: DOMContentLoadedを待ってから初期化処理を実行する
document.addEventListener('DOMContentLoaded', () => {
    loadDeckData(); // deckManager.jsの関数
    addGlobalEventListeners();
    showTitleScreen();
});