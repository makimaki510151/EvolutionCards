// カードの基本データ (複数効果、レベル対応)
const ALL_CARDS = [
    // 1. 基本点カード (レベルアップでスコア増加)
    { 
        id: 'score_1', 
        name: '基本点', 
        type: 'Score', 
        baseEvolution: 0, // 初期レベル
        effects: [
            {
                type: 'Score',
                description: '{value}点獲得',
                params: { 
                    score: [2, 4, 6] // Lv.0, Lv.1, Lv.2 のスコア値
                }
            }
        ]
    },
    // 2. 加速点カード (レベルアップでスコア増加とドロー効果を追加)
    { 
        id: 'score_2', 
        name: '加速点', 
        type: 'Score', 
        baseEvolution: 0,
        effects: [
            {
                type: 'Score',
                description: '{value}点獲得',
                params: { 
                    score: [4, 6, 8]
                }
            },
            {
                type: 'Draw',
                description: 'カードを{value}枚引く',
                params: {
                    drawCount: [0, 1, 1] // Lv.0: 0枚, Lv.1以降: 1枚
                }
            }
        ]
    },
    // 3. 倍化カード (レベルアップで倍率強化)
    { 
        id: 'combo_x2', 
        name: '倍化', 
        type: 'Buff', 
        baseEvolution: 0,
        effects: [
            {
                type: 'Multiplier',
                description: '次に使うカードの効果を{value}倍にする',
                params: {
                    multiplier: [2, 3, 4]
                }
            }
        ]
    },
    // 4. クイックカード (レベルアップで無視回数を増加)
    { 
        id: 'combo_ignore', 
        name: 'クイック', 
        type: 'Cost', 
        baseEvolution: 0,
        effects: [
            {
                type: 'CostIgnore',
                description: '次の{value}枚のカードを使用枚数にカウントしない',
                params: {
                    ignoreCount: [1, 2, 3]
                }
            }
        ]
    },
];

/**
 * 指定されたカードと進化レベルに基づき、その効果をまとめたテキストを生成する。
 * @param {object} card - ALL_CARDSからコピーされたカードオブジェクト
 * @returns {string} - 効果テキストのHTML文字列
 */
function generateEffectText(card) {
    const currentLevel = card.evolution || card.baseEvolution || 0;
    
    // 現在の効果テキスト
    let effectText = card.effects.map(effect => {
        const valueKey = Object.keys(effect.params)[0]; // paramsのキー (e.g., score, drawCount)
        const value = effect.params[valueKey][Math.min(currentLevel, effect.params[valueKey].length - 1)];
        
        // 値が0の場合は効果を表示しない（例: Lv.0のドロー効果）
        if (value === 0 && effect.type === 'Draw') return null;

        return effect.description.replace('{value}', value);
    }).filter(text => text !== null);

    // Lv表示を追加
    if (currentLevel > 0) {
        return `<p class="card-effect">Lv.${currentLevel}：${effectText.join(' / ')}</p>`;
    } else {
        return `<p class="card-effect">${effectText.join(' / ')}</p>`;
    }
}

/**
 * カードの進化ロジックを定義し、適用する。
 * @param {object} card - 進化させるカードオブジェクト
 * @returns {object} - 進化後のカードオブジェクト
 */
function applyEvolution(card) {
    const MAX_LEVEL = 2; // カードの最大進化レベルを設定
    
    if (card.evolution >= MAX_LEVEL) {
        // 最大レベルに達している場合は進化しない
        alert(`${card.name} は最大レベルです！`);
        return card;
    }

    card.evolution = (card.evolution || 0) + 1; // 進化レベルをインクリメント

    // 既に進化済みを示すIDのSuffixを付与/更新
    card.id = `${card.id.split('_evo')[0]}_evo${card.evolution}`;

    // 効果テキストを再生成 (game.jsで描画時に自動更新されるため、ここでは不要だが、データとして持たせる場合はここで更新)
    
    return card;
}