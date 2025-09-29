// カードの基本データ
const ALL_CARDS = [
    // 1. 直接スコアカード
    { id: 'score_1', name: '基本点', type: 'Score', baseScore: 2, effect: '+2点獲得', evolution: 0 },
    { id: 'score_2', name: '加速点', type: 'Score', baseScore: 4, effect: '+4点獲得', evolution: 0 },
    { id: 'score_3', name: '大点', type: 'Score', baseScore: 6, effect: '+6点獲得', evolution: 0 },

    // 2. バフ/デバフカード（コンボの核）
    { id: 'combo_x2', name: '倍化', type: 'Buff', effect: '次に使うカードの効果を2倍にする', evolution: 0 },
    { id: 'combo_ignore', name: 'クイック', type: 'Cost', effect: '次のカードを使用枚数にカウントしない', evolution: 0 },

    // 3. リソース操作カード
    { id: 'draw_1', name: 'ドロー', type: 'Resource', effect: 'カードを1枚引く', evolution: 0 },
    { id: 'discard_score', name: '廃棄点', type: 'Resource', effect: '手札を1枚捨てて、+5点獲得', evolution: 0 },
    { id: 'trash_remove', name: '除去', type: 'Resource', effect: '手札から選んだカードを永久にデッキ外へ', evolution: 0 },
];

/**
 * カードの進化ロジックを定義する関数
 * @param {object} card - 進化させるカードオブジェクト
 * @returns {object} - 進化後のカードオブジェクト
 */
function applyEvolution(card) {
    card.evolution += 1; // 進化レベルをインクリメント

    // 進化内容をタイプごとに定義（簡易的な実装）
    switch (card.type) {
        case 'Score':
            card.baseScore += 2; // スコアを強化
            card.effect = `+${card.baseScore}点獲得 (Lv.${card.evolution})`;
            break;
        case 'Buff':
            if (card.id === 'combo_x2') {
                card.effect = `次に使うカードの効果を${2 + card.evolution}倍にする (Lv.${card.evolution})`;
            }
            break;
        case 'Resource':
            if (card.id === 'draw_1' && card.evolution === 1) {
                card.effect = 'カードを2枚引く (Lv.1)'; // 1段階目で2枚ドローに強化
            } else if (card.id === 'discard_score') {
                card.baseScore = 5 + (card.evolution * 3);
                card.effect = `手札を1枚捨てて、+${card.baseScore}点獲得 (Lv.${card.evolution})`;
            }
            break;
        case 'Cost':
            if (card.id === 'combo_ignore' && card.evolution === 1) {
                 card.effect = '次の2枚のカードを使用枚数にカウントしない (Lv.1)';
            }
            break;
    }

    // IDを更新して、進化後のカードだと分かるようにする
    card.id = `${card.id}_evo${card.evolution}`;

    return card;
}