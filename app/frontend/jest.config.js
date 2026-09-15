module.exports = {
    preset: "@react-native/jest-preset",

    moduleNameMapper: {
        "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    },

    moduleFileExtensions: [
        "ts",
        "tsx",
        "js",
        "jsx",
        "json",
        "node",
    ],

    transformIgnorePatterns: [
        "node_modules/(?!(react-native|@react-native|react-native-safe-area-context)/)",
    ],
};