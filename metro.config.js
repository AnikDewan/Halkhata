const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

// Drizzle ORM: Add .sql extension resolver
config.resolver.sourceExts.push('sql');

// withUniwindConfig MUST be the outermost wrapper
module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
});
