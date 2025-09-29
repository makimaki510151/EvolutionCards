// uiRenderer.js

import { gameState, useCard, selectEvolutionCard, endTurn } from './gameCore.js'; // <- selectEvolutionCard と endTurn を追加
import { generateEffectText } from './cards.js';

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


// --- 描画関数 ---

/** 描画の更新 */
export function updateDisplay() {
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
export function createCardElement(card, isEvolutionChoice = false) {
    const cardEl = document.createElement('div');
    cardEl.className = `card ${isEvolutionChoice ? 'evolution-choice-card' : ''}`;

    // カードデータには進化レベルが格納されているため、それを generateEffectText に渡す
    const cardData = {
        ...card,
        evolution: card.evolution // card.evolutionを使用
    };
    const effectHtml = generateEffectText(cardData);

    cardEl.innerHTML = `
        <div class="card-title">${card.name}</div>
        ${effectHtml}
    `;
    cardEl.dataset.id = card.id;
    // イベントリスナーはここで設定
    cardEl.onclick = () => isEvolutionChoice ? selectEvolutionCard(card) : useCard(card); // gameCore.jsの関数を呼び出し
    return cardEl;
}

/** 手札の描画 */
export function renderHand() {
    $handArea.innerHTML = '<h2>手札</h2>';
    gameState.hand.forEach((card, index) => {
        const cardEl = createCardElement(card);
        cardEl.dataset.index = index;
        $handArea.appendChild(cardEl);
    });
}


// --- 進化/ゲームオーバー画面表示 ---

export function showEvolutionScreen() {
    $overlay.classList.remove('hidden');
    $evolutionScreen.classList.remove('hidden');
    $gameoverScreen.classList.add('hidden');
    renderEvolutionChoices();
    document.getElementById('evo-count').textContent = gameState.evolutionPhase.count;
}

export function renderEvolutionChoices() {
    $evolutionChoices.innerHTML = '';
    // 候補カードはベースデータとして扱うため、進化レベルを強制的に0にする
    gameState.evolutionPhase.candidates.forEach(card => {
        const baseCard = JSON.parse(JSON.stringify(card));
        baseCard.evolution = 0; // 表示用として強制的に0にする
        
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'evolution-card-wrapper';
        const cardEl = createCardElement(baseCard, true);
        cardWrapper.appendChild(cardEl);
        $evolutionChoices.appendChild(cardWrapper);
    });
}

export function showGameOverScreen() {
    $overlay.classList.remove('hidden');
    $gameoverScreen.classList.remove('hidden');
    $evolutionScreen.classList.add('hidden');

    // ... スコア表示ロジック
    // document.getElementById('final-stage').textContent = finalStage;
    // document.getElementById('high-score').textContent = gameState.highScore;
}