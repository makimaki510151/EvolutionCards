// uiRenderer.js

import { gameState, useCard, selectEvolutionCard, endTurn } from './gameCore.js';
import { generateEffectText, generateFullEffectText } from './cards.js';

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

/**
 * カードDOM要素を作成する
 * @param {object} card - カードオブジェクト
 * @param {boolean} isEvolutionChoice - 進化候補カードかどうか
 * @returns {HTMLElement} - 作成されたカード要素
 */
function createCardElement(card, isEvolutionChoice = false) { // 🌟 handIndex引数は renderHand で処理するため削除
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.id = card.id;
    cardEl.dataset.name = card.name;

    let htmlContent = `
        <div class="card-header">
            <span class="card-name">${card.name}</span>
            <span class="card-type">${card.type}</span>
        </div>
    `;

    if (isEvolutionChoice) {
        // 進化画面での表示 (レベルと効果の説明文の比較のみ)
        const currentLevel = card.evolution || card.baseEvolution || 0;
        const nextLevel = Math.min(currentLevel + 1, 2);

        const currentDisplayLevel = currentLevel + 1;
        const nextDisplayLevel = nextLevel + 1;

        // 🌟 修正1: generateFullEffectText を使って完全な説明文を取得
        const currentFullText = generateFullEffectText(card, currentLevel);
        const nextFullText = generateFullEffectText(card, nextLevel);

        // 🌟 修正2: 効果の移り変わりを表示するセクションのみを使用
        let comparisonHtml = `
            <div class="effect-description-comparison">
                <p>現在 (Lv.${currentDisplayLevel}): <span class="current-full-text">${currentFullText}</span></p>
                <p>進化後 (Lv.${nextDisplayLevel}): <span class="next-full-text-improved">${nextFullText}</span></p>
            </div>
        `;

        // レベル表示
        htmlContent += `<p class="card-level">Lv.${currentDisplayLevel} → Lv.${nextDisplayLevel}</p>`;

        // 🌟 修正3: 全体の効果説明のみを表示
        htmlContent += `<div class="card-effect-comparison">`;
        htmlContent += comparisonHtml;
        // 詳細な値の比較部分は完全に削除
        htmlContent += `</div>`;

        // クリックイベントの設定
        cardEl.addEventListener('click', () => selectEvolutionCard(card));

    } else {
        // 通常の手札表示の場合
        htmlContent += generateEffectText(card);
    }

    cardEl.innerHTML = htmlContent;
    return cardEl;
}

/** 手札の描画 */
export function renderHand() {
    $handArea.innerHTML = '<h2>手札</h2>';
    gameState.hand.forEach((card, index) => {
        const cardEl = createCardElement(card);
        // 🌟 修正: カード要素に手札内のインデックスを追加
        cardEl.dataset.handIndex = index;

        // 🌟 修正: クリックイベントリスナーをここで設定し、インデックスを gameCore.useCard に渡す
        cardEl.addEventListener('click', (e) => {
            // イベントターゲットからインデックスを取得
            const handIndex = parseInt(e.currentTarget.dataset.handIndex, 10);
            if (!isNaN(handIndex)) {
                // 🌟 useCardにインデックスを渡す
                useCard(handIndex);
            }
        });

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

    // 候補カードはマスターリストからのコピーですが、
    // 選択フェーズ中にレベルが更新された場合に備え、masterCardListから最新レベルを取得します。
    gameState.evolutionPhase.candidates.forEach(card => {

        // 🌟 修正: masterCardListから現在の最新のレベルを取得し、候補カードのコピーに適用する
        const searchId = card.id.split('_evo')[0];
        // masterCardListの中から、IDが一致する最新のカードデータを見つける
        const masterCard = gameState.masterCardList.find(c => c.id.split('_evo')[0] === searchId);

        // 表示用のカードオブジェクトをディープコピー
        const cardToDisplay = JSON.parse(JSON.stringify(card));

        // masterCardが見つかった場合、その最新のレベルを反映させる
        if (masterCard) {
            const currentLevel = masterCard.evolution !== undefined ? masterCard.evolution : masterCard.baseEvolution;
            if (currentLevel !== undefined) {
                // コピーしたカードのレベル情報（evolutionまたはbaseEvolution）を最新レベルで上書きする
                if (cardToDisplay.evolution !== undefined) {
                    cardToDisplay.evolution = currentLevel;
                } else if (cardToDisplay.baseEvolution !== undefined) {
                    cardToDisplay.baseEvolution = currentLevel;
                }
            }
        }

        // cardToDisplayを使用し、カード要素を作成
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'evolution-card-wrapper';
        // cardToDisplayには、以前の選択でレベルアップした最新の情報が反映されています
        const cardEl = createCardElement(cardToDisplay, true); // isEvolutionChoice = true
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