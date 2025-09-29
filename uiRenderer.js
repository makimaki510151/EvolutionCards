// uiRenderer.js

import { gameState, useCard, selectEvolutionCard, endTurn } from './gameCore.js';
import { generateEffectText, generateFullEffectText, getCardMaxEvolution } from './cards.js';

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
const $finalScore = document.getElementById('final-score');


// --- 描画関数 ---

/** 描画の更新 */
export function updateDisplay() {
    $scoreInfo.textContent = gameState.currentScore;
    $targetScore.textContent = gameState.targetScore;
    $stageInfo.textContent = gameState.stage;
    // 🌟 修正: コスト無視中はカード使用回数の表示を調整
    const displayUses = gameState.costIgnoreCount > 0 ? '∞' : (gameState.maxCardUses - gameState.cardsUsedThisTurn);
    $useCount.textContent = displayUses;
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
function createCardElement(card, isEvolutionChoice = false) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.id = card.id;
    cardEl.dataset.name = card.name;
    cardEl.classList.add(`card-type-${card.type ? card.type.toLowerCase() : 'default'}`);

    let htmlContent = `
        <div class="card-header">
            <span class="card-name">${card.name}</span>
            <span class="card-type">${card.type}</span>
        </div>
    `;

    if (isEvolutionChoice) {
        const currentLevel = card.evolution || card.baseEvolution || 0;
        const maxEvo = getCardMaxEvolution(card);
        const nextLevel = currentLevel + 1;

        const currentDisplayLevel = currentLevel + 1;
        const nextDisplayLevel = nextLevel + 1;

        const currentFullText = generateFullEffectText(card, currentLevel);

        let comparisonHtml;
        if (currentLevel < maxEvo) {
            const nextFullText = generateFullEffectText(card, nextLevel);
            comparisonHtml = `
                <div class="effect-description-comparison">
                    <p>現在 (Lv.${currentDisplayLevel}): <span class="current-full-text">${currentFullText}</span></p>
                    <p>進化後 (Lv.${nextDisplayLevel}): <span class="next-full-text-improved">${nextFullText}</span></p>
                </div>
            `;
            htmlContent += `<p class="card-level">Lv.${currentDisplayLevel} → Lv.${nextDisplayLevel}</p>`;
        } else {
            comparisonHtml = `
                <div class="effect-description-comparison">
                     <p><span class="max-level">MAX</span> ${currentFullText}</p>
                </div>
            `;
            htmlContent += `<p class="card-level">Lv.${currentDisplayLevel} (MAX)</p>`;
        }

        htmlContent += `<div class="card-effect-comparison">${comparisonHtml}</div>`;

        if (currentLevel < maxEvo) {
            // イベントリスナーは renderEvolutionChoices に移譲
        } else {
            cardEl.classList.add('used'); // MAXレベルのカードはクリック不可に
        }

    } else {
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
        cardEl.dataset.handIndex = index;

        cardEl.addEventListener('click', (e) => {
            const handIndex = parseInt(e.currentTarget.dataset.handIndex, 10);
            if (!isNaN(handIndex)) {
                useCard(handIndex);
            }
        });

        cardEl.addEventListener('mouseenter', () => {
            playHoverSFX();
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
    $evolutionChoices.innerHTML = ''; // 既存の選択肢をクリア
    document.getElementById('evo-count').textContent = gameState.evolutionPhase.count; // 🌟 選択肢再描画時にカウントも更新

    // masterCardListのインスタンス（進化レベル表示用）をbaseIdでグループ化
    const evolvableCardInstances = {};
    gameState.masterCardList.forEach(card => {
        if (!evolvableCardInstances[card.baseId]) {
            evolvableCardInstances[card.baseId] = [];
        }
        evolvableCardInstances[card.baseId].push(card);
    });

    gameState.evolutionPhase.candidates.forEach(baseCard => {

        // 🚨 修正点 1: cardWrapperをこのループのスコープで定義し、エラーを解消
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'evolution-card-wrapper';

        // 表示用のカードオブジェクトを作成 (baseCardはgameCore.js側でbaseIdが設定済みである前提)
        const cardToDisplay = JSON.parse(JSON.stringify(baseCard));

        // 🚨 修正点 2: フィルタリングとレベル設定ロジックを統合（以前の提案から流用）
        const instances = evolvableCardInstances[baseCard.id];
        if (instances && instances.length > 0) {
            // 候補の中から最もレベルの低いカードのレベルを基準に表示
            const minLevel = Math.min(...instances.map(c => c.evolution || c.baseEvolution || 0));
            cardToDisplay.evolution = minLevel;
        }

        const cardEl = createCardElement(cardToDisplay, true);
        cardWrapper.appendChild(cardEl);

        // 🚨 修正点 3: クリックイベントリスナーを追加 (最重要: ゲーム進行ロジック)
        cardWrapper.addEventListener('click', async () => {
            if (!gameState.evolutionPhase.active) return;
            // MAXレベルのカードはクリック不可
            if (cardEl.classList.contains('used')) return;

            // baseCardにはgameCore.js側の修正でbaseIdが設定されている
            await selectEvolutionCard(baseCard);

            // 🌟 修正: selectEvolutionCard内で画面を閉じる処理が入るため、ここでは残り回数がある場合のみ再描画する
            if (gameState.evolutionPhase.active) {
                renderEvolutionChoices();
            }
        });

        $evolutionChoices.appendChild(cardWrapper);
    });
}

export function showGameOverScreen() {
    $overlay.classList.remove('hidden');
    $gameoverScreen.classList.remove('hidden');
    $evolutionScreen.classList.add('hidden');
    document.getElementById('final-stage').textContent = gameState.stage;
    $finalScore.textContent = gameState.currentScore;
    document.getElementById('high-score').textContent = gameState.highScore;
}

// --- 効果音の定義 (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency, duration, type = 'tone', pitchBend = 1.0) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    if (type === 'tone') {
        const oscillator = audioCtx.createOscillator();
        oscillator.connect(gainNode);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, now);

        if (pitchBend !== 1.0) {
            oscillator.frequency.exponentialRampToValueAtTime(frequency * pitchBend, now + 0.15);
        }

        oscillator.start(now);
        oscillator.stop(now + duration);
    } else if (type === 'noise') {
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = buffer;
        noiseSource.connect(gainNode);

        noiseSource.start(now);
        noiseSource.stop(now + duration);
    }
}

export function playUseSFX() {
    playSound(440, 0.3, 'tone', 1.5);
}

export function playDrawSFX() {
    playSound(0, 0.1, 'noise');
}

export function playHoverSFX() {
    playSound(220, 0.05, 'tone', 1.0);
}

export function playEvolutionSFX() {
    playSound(1000, 0.4, 'tone', 1.8);
}

// --- カード飛行アニメーションの定義 ---

/**
 * カードを引くアニメーションを実行する
 * @param {object} card - アニメーションさせるカードのデータ
 * @param {number} cardIndexInHand - アニメーション後にカードが手札の何番目に来るか (CSS位置計算用)
 * @returns {Promise<void>} - アニメーション完了時に解決するPromise
 */
export function animateDrawCard(card, cardIndexInHand) {
    // 🌟 修正点: 引数で受け取った 'card' の存在をチェック
    if (!card) {
        return Promise.resolve();
    }

    // 🌟 修正点: createCardElement に 'card' と 'cardIndexInHand' を渡す
    // (createCardElementはcards.jsからimportされている必要があります)
    const tempCardEl = createCardElement(card, cardIndexInHand, false);
    tempCardEl.classList.add('flying-card');

    const $deckInfo = document.getElementById('deck-info');
    const $handArea = document.getElementById('hand-area');

    const deckRect = $deckInfo.getBoundingClientRect();
    const startX = deckRect.left + deckRect.width / 2;
    const startY = deckRect.top + deckRect.height / 2;

    const handRect = $handArea.getBoundingClientRect();
    const cardWidth = 150;
    const cardHeight = 210;
    const cardSpacing = 20; // カード間の余白を仮定 (必要に応じて調整してください)

    // ★★★ 終了座標の動的計算 (手札の並び順に合わせる) ★★★
    // 🌟 依存関係: gameState.hand.length を使用して総数を取得
    const numCards = gameState.hand.length;
    const totalHandWidth = (numCards * cardWidth) + ((numCards - 1) * cardSpacing);

    // 手札エリアの左端を基準とした、カード群の開始位置
    const handAreaPadding = 0; // 必要に応じて調整
    const handStartOffset = handRect.width / 2 - totalHandWidth / 2 + handAreaPadding;

    // 今回引いたカード（手札の最後のカード）の中心X座標
    const targetCardSlotX = handRect.left + handStartOffset +
        (cardIndexInHand * (cardWidth + cardSpacing)) + cardWidth / 2;

    // ターゲットのY座標は手札エリアの中央
    const targetCardSlotY = handRect.top + handRect.height / 2;

    const endX = targetCardSlotX;
    const endY = targetCardSlotY;

    // 飛び上がるための中間点
    const midX = startX + (endX - startX) * 0.5;
    const midY = Math.min(startY, endY) - 100; // 開始点と終了点の上側-100で弧を描く

    // CSS変数を「左上座標」として保存
    tempCardEl.style.setProperty('--start-x', `${startX - cardWidth / 2}px`);
    tempCardEl.style.setProperty('--start-y', `${startY - cardHeight / 2}px`);
    tempCardEl.style.setProperty('--mid-x', `${midX - cardWidth / 2}px`);
    tempCardEl.style.setProperty('--mid-y', `${midY - cardHeight / 2}px`);
    tempCardEl.style.setProperty('--end-x', `${endX - cardWidth / 2}px`);
    tempCardEl.style.setProperty('--end-y', `${endY - cardHeight / 2}px`);

    // ------------------------------------

    document.body.appendChild(tempCardEl);

    return new Promise(resolve => {
        const onAnimationEnd = () => {
            tempCardEl.removeEventListener('animationend', onAnimationEnd);
            if (document.body.contains(tempCardEl)) {
                tempCardEl.remove();
            }
            resolve();
        };

        tempCardEl.addEventListener('animationend', onAnimationEnd);

        setTimeout(() => {
            if (document.body.contains(tempCardEl)) {
                onAnimationEnd();
            }
        }, 500); // アニメーションが完了しなかった場合の強制終了
    });
}