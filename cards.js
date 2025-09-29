// cards.js

// カードの基本データ (複数効果、レベル対応)
export const ALL_CARDS = [
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
 * カードの指定されたレベルにおける効果（テキストと値）のリストを取得する。（既存関数）
 * @param {object} card - カードオブジェクト
 * @param {number} level - 取得したい進化レベル (0, 1, 2)
 * @returns {Array<{description: string, value: number, type: string}>} - 効果データ配列
 */
export function getCardEffectData(card, level) {
    const data = [];

    // ... 既存のロジックはそのまま ...
    card.effects.forEach(effect => {
        const valueKey = Object.keys(effect.params)[0]; // paramsのキー (e.g., score, drawCount)
        const values = effect.params[valueKey];
        const index = Math.min(level, values.length - 1);
        const value = values[index];

        if (value === 0 && effect.type === 'Draw') return;

        data.push({
            description: effect.description, // ここではプレースホルダを残す
            value: value,
            type: effect.type
        });
    });

    return data;
}

/**
 * 🌟 新規追加: カードの指定されたレベルにおける完全な効果テキストを生成する。
 * @param {object} card - カードオブジェクト
 * @param {number} level - 取得したい進化レベル (0, 1, 2)
 * @returns {string} - "効果A / 効果B" の形式で結合された完全な効果テキスト
 */
export function generateFullEffectText(card, level) {
    // getCardEffectData はこの関数内で使用されます
    const data = getCardEffectData(card, level);

    let text = data.map(effect => {
        // descriptionの{value}を実際の値に置き換える
        return effect.description.replace(/\{\w+\}/, effect.value);
    }).join(' / ');

    return text || "効果なし";
}


/**
 * 手札表示用: 指定されたカードと進化レベルに基づき、その効果をまとめたテキストを生成する。
 * @param {object} card - ALL_CARDSからコピーされたカードオブジェクト
 * @returns {string} - 効果テキストのHTML文字列
 */
export function generateEffectText(card) {
    const currentLevel = card.evolution || card.baseEvolution || 0;
    const displayLevel = currentLevel + 1;

    // generateFullEffectText を使用して効果テキストを取得
    const effectText = generateFullEffectText(card, currentLevel);

    // 常に表示レベル付きで出力
    return `<p class="card-effect">Lv.${displayLevel}：${effectText}</p>`;
}

/**
 * カードの進化ロジックを定義し、適用する。
 * @param {object} card - 進化させるカードオブジェクト
 * @returns {object} - 進化後のカードオブジェクト
 */
export function applyEvolution(card) {
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