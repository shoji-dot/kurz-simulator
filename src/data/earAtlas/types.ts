/**
 * data/earAtlas/types.ts ── Ear Atlas 型定義 (Phase2 / Phase2.1)
 *
 * 座標系統合_解剖エンジン設計書_v1.0 3.6節の実装。
 * 教育・評価・シミュレーション・AI・症例生成が共通して参照する
 * 「唯一のマスターデータ(Single Source of Truth)」として設計する。
 *
 * 【重要】本Phaseでは既存ファイル（dangerZones.ts / RealAnatomyModels.tsx の
 * StructureKey / AnatomyScene.tsx の ENDO_ZONES 等）は一切変更しない。
 * Ear Atlasは完全新規・独立追加であり、既存の描画コード・データからは参照されない。
 * 既存ID体系との対応は `legacyIds` フィールドに記録し、将来の統合（Phase3以降）に備える。
 *
 * Phase2.1（2026-07-16 shojiさんレビューでの指摘に対応、Phase3着手前の追加）:
 * - 経路構造（神経等）向けの `shapeType` / `orientation` / `path`
 *   （開始点・終了点・走行方向tangent・法線normal）を追加。
 *   「顔面神経の2mm前方」のような方向依存の計算に必要という指摘に対応した。
 * - `EarAtlasNormalSize` に `measurementSource`（CT/Literature/Manual/Measured/Estimated）を追加。
 *   将来AIが寸法値の出典を機械的に判別できるようにするための指示。
 */
import type { Vec3Tuple } from '../../engine/coordinates/types';

/** Ear Atlas上の構造物カテゴリ。 */
export type EarAtlasCategory = 'ossicle' | 'membrane' | 'nerve' | 'vascular' | 'window' | 'bone';

/**
 * 危険度。
 * - 'critical' : 既存 DANGER_ZONES（削開時に真に危険）と同一の重要度
 * - 'caution'  : 既存 ENDO_ZONES severity='danger'（内視鏡近接アラート対象）と同一
 * - 'safe'     : 既存 ENDO_ZONES severity='warning'（近接時に注意喚起のみ）と同一
 * 既存の重要度分類をそのまま踏襲したものであり、新たな医学的判断を加えていない。
 */
export type EarAtlasDangerLevel = 'critical' | 'caution' | 'safe';

/** 情報の出典区分。既存のsourceTag運用（feedback.mdのソース管理ルール）と同一の3分類。 */
export type EarAtlasSourceTag = 'KURZ固有情報' | '一般耳科知識' | '要確認事項';

/** 座標・寸法値の検証方法。 */
export type EarAtlasVerificationMethod = '実測(pygltflib)' | '目視確認' | '文献値' | '未検証';

export type EarAtlasSizeMeasureType = 'diameter' | 'length' | 'radius' | 'boundingBox';

/**
 * 寸法値の機械可読な出典分類（Phase2.1追加）。
 * 既存の`sourceTag`/`lastVerifiedMethod`（日本語・人間向け）と役割は近いが、
 * こちらは英語enumでAI・自動処理からの参照を想定して追加した。両者は併存し、どちらかへの
 * 統廃合はPhase3以降の判断とする。
 */
export type EarAtlasMeasurementSource = 'CT' | 'Literature' | 'Manual' | 'Measured' | 'Estimated';

export interface EarAtlasNormalSize {
  readonly measureType: EarAtlasSizeMeasureType;
  /** measureTypeが'boundingBox'以外の場合の値(mm)。 */
  readonly valueMm?: number;
  /** measureTypeが'boundingBox'の場合の値(mm、WORLD軸)。BoundingBox Registryへそのまま渡せる形。 */
  readonly boundingBoxMm?: Vec3Tuple;
  readonly sourceTag: EarAtlasSourceTag;
  readonly lastVerifiedMethod: EarAtlasVerificationMethod;
  /** Phase2.1追加。値を投入する際は必ず設定すること。 */
  readonly measurementSource: EarAtlasMeasurementSource;
}

/** 他の構造物を基準とした相対位置。距離検証(Coordinate Validation Report)にそのまま使える形にしてある。 */
export interface EarAtlasRelativePosition {
  /** 基準となる構造物のEar Atlas id。 */
  readonly referenceId: string;
  /** 基準からのオフセット(WORLD軸、mm)。 */
  readonly offsetMm: Vec3Tuple;
  /** 基準との直線距離(mm、参考値)。文献等に記載がある場合のみ設定する。 */
  readonly distanceMm?: number;
  readonly descriptionJa?: string;
}

/** 既存ID体系との対応。統合はPhase3以降、本Phaseでは記録のみ。 */
export interface EarAtlasLegacyIds {
  /** RealAnatomyModels.tsx の StructureKey。 */
  readonly structureKey?: string;
  /** data/dangerZones.ts の DangerZone.id。 */
  readonly dangerZoneId?: string;
  /** AnatomyScene.tsx の ENDO_ZONES（非export）の id。 */
  readonly endoZoneId?: string;
}

/**
 * 構造物の形状分類（Phase2.1追加）。
 * - 'point' : 単一点で十分表現できる構造物（耳小骨・窓・膝部などのランドマーク）
 * - 'path'  : 経路構造（神経の走行区間など）。`path`フィールドで開始点・終了点・
 *             各点のtangent/normalを持つ。
 */
export type EarAtlasShapeType = 'point' | 'path';

/** 姿勢（向き）を表すローカル座標系。WORLD座標系での単位ベクトル3本。 */
export interface EarAtlasLocalFrame {
  /** 進行方向・正面方向の単位ベクトル。 */
  readonly forward: Vec3Tuple;
  /** 上方向の単位ベクトル。 */
  readonly up: Vec3Tuple;
  /** forward×upから導出される第3軸の単位ベクトル。 */
  readonly right: Vec3Tuple;
}

/** 経路（Polyline）上の1点。 */
export interface EarAtlasPathPoint {
  readonly positionWorld: Vec3Tuple;
  /** この点における進行方向（単位接線ベクトル、WORLD座標系）。 */
  readonly tangent: Vec3Tuple;
  /**
   * 進行方向に垂直な参照法線（幾何学的に導出。engine/coordinates/vectorMath.ts の
   * computeReferenceNormal() 参照）。「構造物の2mm前方」等のオフセット計算に使える。
   * 解剖学的な前方/後方の意味付けまでは保証しない。
   */
  readonly normal: Vec3Tuple;
}

/** 経路構造（神経等）のPolylineデータ。2点以上を想定。 */
export interface EarAtlasPath {
  readonly points: readonly EarAtlasPathPoint[];
}

export interface EarAtlasEntry {
  /** Ear Atlas上の永続ID。新しいID体系の基準（カテゴリ名前空間つき、例: 'ossicle.malleus'）。 */
  readonly id: string;
  readonly legacyIds?: EarAtlasLegacyIds;

  readonly nameJa: string;
  readonly nameEn: string;
  readonly abbreviation?: string;
  readonly category: EarAtlasCategory;

  /** 正常サイズ(mm)。信頼できる出典が無いエントリでは意図的に未設定のままにする（推測値は入れない）。 */
  readonly normalSizeMm?: EarAtlasNormalSize;
  /** 正常位置。WORLD座標(単一の正準値)。coordinates/transforms.ts の変換関数経由でのみ設定すること。 */
  readonly positionWorld?: Vec3Tuple;
  /** 正常位置（相対）。他構造物からの相対関係が文献・既存コメントで裏付けられる場合のみ設定する。 */
  readonly relativePosition?: EarAtlasRelativePosition;
  /** 隣接構造物のEar Atlas id一覧。 */
  readonly adjacentStructureIds?: readonly string[];

  /** 形状分類（Phase2.1追加）。 */
  readonly shapeType: EarAtlasShapeType;
  /** shapeType==='point'の構造物向けの姿勢。向きに意味が乏しい構造物では省略可（Phase2.1追加）。 */
  readonly orientation?: EarAtlasLocalFrame;
  /** shapeType==='path'の構造物の経路データ（Phase2.1追加）。 */
  readonly path?: EarAtlasPath;

  readonly dangerLevel: EarAtlasDangerLevel;
  readonly educationCommentJa?: string;

  readonly color: string;
  /** 表示ON/OFFの既定値。 */
  readonly defaultVisible: boolean;

  readonly sourceTag: EarAtlasSourceTag;
  readonly lastVerifiedMethod: EarAtlasVerificationMethod;
}
