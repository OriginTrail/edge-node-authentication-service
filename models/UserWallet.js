// models/user.js
module.exports = (sequelize, DataTypes) => {
    return sequelize.define(
        'UserWallet',
        {
            wallet: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            private_key: {
                type: DataTypes.STRING,
                allowNull: false
            },
            blockchain: {
                type: DataTypes.STRING,
                allowNull: false
            },
            browser_only: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            }
        },
        {
            tableName: 'user_wallets' // Specify the table name here
        }
    );
};
