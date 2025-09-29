// main.js

import { renderDeckSelect, renderDeckManagement, setSelectedDeckIndex, createNewDeck, saveDeckChanges, closeEditScreen, loadDeckData } from './deckManager.js';
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
    // タイトル画面
    $startNewGameButton.addEventListener('click', showDeckSelectScreen);
    $manageDeckButton.addEventListener('click', showDeckManagementScreen);

    // デッキ選択画面
    document.getElementById('back-to-title-button-select').addEventListener('click', showTitleScreen);
    $confirmDeckButton.addEventListener('click', () => {
        // 選択されたラジオボタンの値を取得
        const selectedRadio = document.querySelector('input[name="selectedDeck"]:checked');
        if (selectedRadio) {
            setSelectedDeckIndex(parseInt(selectedRadio.value)); // deckManager.jsの関数
            showGameScreen();
        } else {
            alert('使用するデッキを選択してください。');
        }
    });

    // デッキ管理画面
    document.getElementById('back-to-title-button-manage').addEventListener('click', showTitleScreen);
    document.getElementById('new-deck-button').addEventListener('click', createNewDeck); // deckManager.jsの関数

    // デッキ編集画面
    document.getElementById('save-deck-button').addEventListener('click', saveDeckChanges); // deckManager.jsの関数
    document.getElementById('cancel-edit-button').addEventListener('click', closeEditScreen); // deckManager.jsの関数
    
    // ゲーム画面のターン終了ボタン
    document.getElementById('end-turn-button').addEventListener('click', endTurn); // gameCore.jsの関数
    
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
// 以前の即時呼び出し (loadDeckData(); addGlobalEventListeners(); showTitleScreen();) は削除