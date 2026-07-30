# Issue-026 case-005確認: 「II型変法」表記の妥当性

**Status**: Draft(shoji確認待ち)
**Date**: 2026-07-29
**位置づけ**: shoji指定順序③。①case-001[完了]・②case-011[完了]と同じ論点をcase-005で確認する。

---

## 既存情報(判断は加えず引用)

| 項目 | 内容 |
|---|---|
| ossicularStatus | malleus: **partial**(菲薄化・残存、Malleus Partial Anchor Reviewで機能的にⅢi-M相当と整理済み) / incus: absent / stapes: suprastructure |
| tags.procedure | 「鼓室形成**II型変法**」、PORP |
| title | 「症例5: ツチ骨柄下PORP（**II型変法**）— 難症例」 |
| description | 「…PORPをツチ骨柄下に設置するが、ツチ骨柄の固定不完全により正確なセンタリングが要求される難症例。」 |
| clinicalNotes | 「**ツチ骨柄**〜アブミ骨頭間距離は約3.0mm（癒着解除後計測）…ツチ骨柄が**菲薄化**しているためPORP頭板の支持面積確保が重要。」 |

## 新原則の適用

再建経路は「ツチ骨柄(菲薄化・残存) → PORP → アブミ骨頭部」であり、case-001/008/011と
構造的に同じⅢi-M相当のパターンに見える。`docs/P3-EA-2_Step_B_Additional_Confirmation_Malleus_Partial_Anchor_Review_Response_v1.0.md`
でも、case-005は「菲薄化・残存・連鎖に関与」しており、機能的Anchor分類はⅢi-M相当と
既に整理済み。

**唯一の相違点**は、tags.procedureが「II型」ではなく「**II型変法**」という、変則を示す
修飾語付きの表記になっている点。

## 確認したい点

1. 「変法」という修飾語は、①分類そのものを変える意味(すなわちⅡ型の亜型として扱う)か、
   それとも②通常のIII型再建だが、ツチ骨柄菲薄化・固定不完全という技術的難度の高さを示す
   ための注記(分類自体はcase-001/011と同じIII型)か。
2. 上記②であれば、「鼓室形成III型」(+難症例である旨は`difficulty: 'advanced'`や
   teachingPointsで既に表現されている)へ統一してよいか。

**回答欄**:

```
(shoji記入欄)
```

## (参考)修正した場合の影響

`title`(「II型変法」→「III型」または「III型難症例」等)・`tags.procedure`
(`鼓室形成II型変法`→`鼓室形成III型`)の変更が中心。descriptionにII/III型の直接記載はなし
(確認済み)。teachingPointsにもII/III型の言及はなし(確認済み)。

## 次のステップ

回答を得たら実装し、`docs/Issue-026_Ossicular_Procedure_Classification_Audit.md`へ反映。
その後、shoji指定順序④(Procedure分類ルールAddendum文書の正式作成)へ進む。
