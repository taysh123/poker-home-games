/**
 * ScreenHeader is now an alias of BrandHeader so every screen shares one header
 * with the logo home anchor + the Sora/DM Serif title system. Existing call sites
 * keep working unchanged (same title/subtitle/onBack/right/large API).
 */
export { default } from './BrandHeader';
