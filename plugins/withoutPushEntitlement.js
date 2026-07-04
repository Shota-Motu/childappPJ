const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * expo-notifications は自動リンクの際、リモート Push 用の
 * 'aps-environment' entitlement を無条件に追加する。
 * このアプリはローカル通知（毎日のリマインド）しか使わないため不要であり、
 * 無料の Apple ID（Personal Team）は Push Notifications capability に
 * 対応していないため、entitlement が残っていると実機ビルドの署名が失敗する。
 * app.json の plugins 配列の末尾に置くことで、他プラグインが設定した後に削除する。
 */
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
};
