'use strict';
const bcrypt = require('bcrypt');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const passwordHash = await bcrypt.hash('edge_node_pass', 10); // Hash the password
        return queryInterface.bulkInsert(
            'Users',
            [
                {
                    username: 'my_edge_node',
                    password: passwordHash,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ],
            {}
        );
    },

    down: async (queryInterface, Sequelize) => {
        return queryInterface.bulkDelete('Users', { username: 'my_edge_node' }, {});
    }
};
