// cards.js

// 🌟 新規: カードごとの最大進化レベル（インデックス）を取得するヘルパー関数
export function getCardMaxEvolution(card) {
    // maxEvolutionが未定義の場合は、デフォルトの最大インデックス2 (Lv.3) を返す
    return card.maxEvolution !== undefined ? card.maxEvolution : 2;
}

// カードの基本データ (複数効果、レベル対応)
export const ALL_CARDS = [
    // 1. 基本点カード (レベルアップでスコア増加)
    {
        id: 'score_1',
        name: '基本点',
        type: 'Score',
        baseEvolution: 0, // 初期レベル
        maxEvolution: 5, // 🌟 追加 (Lv.6が最大)
        effects: [
            {
                type: 'Score',
                description: '{value}点獲得',
                params: {
                    score: [2, 5, 8, 11, 14, 17, 20] // Lv.0, Lv.1, Lv.2 のスコア値
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
        maxEvolution: 2, // 🌟 追加 (Lv.3が最大)
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
        maxEvolution: 2, // 🌟 追加 (Lv.3が最大)
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
        maxEvolution: 2, // 🌟 追加 (Lv.3が最大)
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
    // --- 新規カード群 (maxEvolution: 2 を追加) ---

    // 5. 集中点 (高スコアだがドロー効果無し)
    {
        id: 'new_score_3',
        name: '集中点',
        type: 'Score',
        baseEvolution: 0,
        maxEvolution: 2, // 🌟 追加
        effects: [
            {
                type: 'Score',
                description: '{value}点獲得',
                params: {
                    score: [7, 10, 13] // score_2より高スコアだが、ドロー効果がない。
                }
            }
        ]
    },
    // 6. 加速ドロー (低スコアでドロー特化)
    {
        id: 'new_draw_2',
        name: '加速ドロー',
        type: 'Draw',
        baseEvolution: 0,
        maxEvolution: 2, // 🌟 追加
        effects: [
            {
                type: 'Draw',
                description: 'カードを{value}枚引く',
                params: {
                    drawCount: [1, 2, 3]
                }
            },
            {
                type: 'Score',
                description: '{value}点獲得',
                params: {
                    score: [1, 1, 1] // スコアはほぼおまけ
                }
            }
        ]
    },
    // 7. 無償 (コスト無視特化)
    {
        id: 'new_cost_ignore_2',
        name: '無償',
        type: 'Cost',
        baseEvolution: 0,
        maxEvolution: 2, // 🌟 追加
        effects: [
            {
                type: 'CostIgnore',
                description: '次の{value}枚のカードを使用枚数にカウントしない',
                params: {
                    ignoreCount: [2, 3, 4] // クイック(1, 2, 3)よりカウントが多いが、スコアや倍率がない。
                }
            }
        ]
    },
    // 8. 増殖 (倍率とドローの複合)
    {
        id: 'new_mult_draw',
        name: '増殖',
        type: 'Buff',
        baseEvolution: 0,
        maxEvolution: 2, // 🌟 追加
        effects: [
            {
                type: 'Multiplier',
                description: '次に使うカードの効果を{value}倍にする',
                params: {
                    multiplier: [1.5, 2, 2.5] // 倍化(combo_x2: 2, 3, 4)より倍率が低い
                }
            },
            {
                type: 'Draw',
                description: 'カードを{value}枚引く',
                params: {
                    drawCount: [1, 1, 1] // ドロー効果を追加
                }
            }
        ]
    },
    // 9. 一時しのぎ (新機能: PurgeSelf - このカード自身を永久にデッキから除去)
    {
        id: 'new_purge_self',
        name: '一時しのぎ',
        type: 'Utility',
        baseEvolution: 0,
        maxEvolution: 2, // 🌟 追加
        effects: [
            {
                type: 'PurgeSelf', // 新しい効果
                description: 'このカードをデッキから永久に除去し、{value}点獲得',
                params: {
                    purgeScore: [5, 10, 15] // 獲得スコア
                }
            },
            {
                type: 'DiscardHand', // 新しい効果
                description: '手札からランダムなカードを{value}枚捨てる',
                params: {
                    discardHand: [1, 0, 0] // Lv.0ではペナルティあり
                }
            }
        ]
    },
    // 10. 機動 (新機能: CardUseMod - 残り使用回数を増やす)
    {
        id: 'new_max_use_add',
        name: '機動',
        type: 'Utility',
        baseEvolution: 0,
        maxEvolution: 2, // 🌟 追加
        effects: [
            {
                type: 'CardUseMod', // 新しい効果
                description: 'このターンの残りカード使用回数を{value}回増やす',
                params: {
                    usesAdd: [1, 2, 3]
                }
            }
        ]
    },
    // 11. 引戻し (新機能: RetrieveDiscard - 捨て札から回収)
    {
        id: 'new_discard_retrieve',
        name: '引戻し',
        type: 'Utility',
        baseEvolution: 0,
        maxEvolution: 2, // 🌟 追加
        effects: [
            {
                type: 'RetrieveDiscard', // 新しい効果
                description: '捨て札からランダムなカードを{value}枚手札に加える',
                params: {
                    retrieveCount: [1, 2, 3]
                }
            },
            {
                type: 'Score',
                description: '{value}点獲得',
                params: {
                    score: [1, 1, 2]
                }
            }
        ]
    },
    // 12. 掃除屋 (スコアと山札回復)
    {
        id: 'new_score_discard_shuffle',
        name: '掃除屋',
        type: 'Score',
        baseEvolution: 0,
        maxEvolution: 2, // 🌟 追加
        effects: [
            {
                type: 'Score',
                description: '{value}点獲得',
                params: {
                    score: [3, 5, 7]
                }
            },
            {
                type: 'ShuffleDiscard', // 捨て札シャッフルを強制的に実行
                description: '捨て札を全て山札に戻しシャッフルする',
                params: {
                    shuffle: [1, 1, 1] // 値はダミー
                }
            }
        ]
    },
    // 13. 調査 (低スコアでドロー。Lv.2でドロー強化)
    {
        id: 'new_draw_low',
        name: '調査',
        type: 'Draw',
        baseEvolution: 0,
        maxEvolution: 2, // 🌟 追加
        effects: [
            {
                type: 'Score',
                description: '{value}点獲得',
                params: {
                    score: [2, 3, 4] // スコアは低め
                }
            },
            {
                type: 'Draw',
                description: 'カードを{value}枚引く',
                params: {
                    drawCount: [1, 1, 2] // Lv.2で2枚ドロー
                }
            }
        ]
    },
    // 14. 急所 (コスト無視と倍率の複合)
    {
        id: 'new_cost_mult',
        name: '急所',
        type: 'Buff',
        baseEvolution: 0,
        maxEvolution: 2, // 🌟 追加
        effects: [
            {
                type: 'CostIgnore',
                description: '次の{value}枚のカードを使用枚数にカウントしない',
                params: {
                    ignoreCount: [1, 1, 2] // 回数は少ない
                }
            },
            {
                type: 'Multiplier',
                description: '次に使うカードの効果を{value}倍にする',
                params: {
                    multiplier: [1.5, 2, 2.5] // 倍率も低め
                }
            }
        ]
    }
];
// ALL_CARDSの定義が終了した後に、既存のgetCardEffectData関数をエクスポートする

/**
 * カードの指定されたレベルにおける効果（テキストと値）のリストを取得する。
 * @param {object} card - カードオブジェクト
 * @param {number} level - 取得したい進化レベル (0, 1, 2, ...)
 * @returns {Array<{description: string, value: number, type: string}>} - 効果データ配列
 */
export function getCardEffectData(card, level) {
    const maxEvo = getCardMaxEvolution(card); // 🌟 カードごとの最大レベルを取得
    const actualLevel = Math.min(level, maxEvo); // 🌟 最大レベルを超えないように制限

    const data = [];

    card.effects.forEach(effect => {
        const valueKey = Object.keys(effect.params)[0];
        const values = effect.params[valueKey];
        const index = Math.min(actualLevel, values.length - 1); // 🌟 actualLevelを使用
        const value = values[index];

        // 値が0でない、または効果がScore, Draw, Multiplier, CostIgnore以外の特殊効果の場合は含める
        if (value !== 0 || !['Score', 'Draw', 'Multiplier', 'CostIgnore'].includes(effect.type)) {
            data.push({
                description: effect.description,
                value: value,
                type: effect.type
            });
        }
    });

    return data;
}

/**
 * カードの効果をまとめたテキストを生成する。（既存関数）
 * @param {object} card - カードオブジェクト
 * @param {number} level - 取得したい進化レベル (0, 1, 2, ...)
 * @returns {string} - 効果テキストの文字列
 */
export function generateFullEffectText(card, level) {
    const data = getCardEffectData(card, level);

    let text = data.map(effect => {
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
    // 🌟 修正: card.evolutionを優先し、未定義の場合はcard.baseEvolution、それでも未定義の場合は0をデフォルトとする
    const currentLevel = card.evolution !== undefined ? card.evolution : (card.baseEvolution !== undefined ? card.baseEvolution : 0);
    const maxEvo = getCardMaxEvolution(card); // 🌟 カードごとの最大レベルを取得
    const displayLevel = currentLevel + 1;
    const maxDisplayLevel = maxEvo + 1;

    let levelText;
    if (currentLevel >= maxEvo) {
        // 🌟 MAX表示
        levelText = `<span class="max-level">MAX</span>`;
    } else {
        levelText = `Lv.${displayLevel}`;
    }

    const effectText = generateFullEffectText(card, currentLevel);

    // 🌟 修正点: コロンの直後に <br> タグを追加し、強制的に改行させる
    return `<p class="card-effect">${levelText} (Max Lv.${maxDisplayLevel})<br>${effectText}</p>`;
}

/**
 * カードの進化ロジックを定義し、適用する。
 * @param {object} card - 進化させるカードオブジェクト (インスタンス)
 * @returns {object} - 進化後のカードオブジェクト
 */
export function applyEvolution(card) {
    // 🌟 変更: card.baseIdからALL_CARDSの情報を取得し、maxEvolutionを確実に参照
    const cardBase = ALL_CARDS.find(c => c.id === card.baseId);
    const maxEvo = getCardMaxEvolution(cardBase || card); // 念のためフォールバック

    // 🌟 変更: card.evolutionが存在し、かつmaxEvo未満の場合のみインクリメント
    // baseEvolutionは初期設定にのみ使用し、進化はevolutionプロパティで行う
    const currentEvolution = card.evolution !== undefined ? card.evolution : (card.baseEvolution || 0);

    if (currentEvolution < maxEvo) {
        // 🌟 変更なし: 選ばれたカードは常にレベルが1上がる（今回はレベル差を付けるロジックは導入しない）
        card.evolution = currentEvolution + 1;
    }

    return card;
}