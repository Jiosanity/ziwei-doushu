export const DATASET_TOPICS = [
  ['overview', '命格总览'], ['personality', '性格'], ['love', '感情'],
  ['career', '事业'], ['wealth', '财运'], ['health', '健康'],
  ['family', '兄弟'], ['children', '子女'], ['move', '迁移'],
  ['friends', '人际'], ['home', '田宅'], ['spirit', '福德'], ['parents', '父母'],
] as const;
export type DatasetTopic = typeof DATASET_TOPICS[number][0];
