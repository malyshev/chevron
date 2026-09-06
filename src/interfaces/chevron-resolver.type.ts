export type FeatureValue = boolean | string | number | null;

export type FeatureResolverFn = () => FeatureValue | Promise<FeatureValue>;

export type FeatureResolver = FeatureValue | FeatureResolverFn;
