// Load environment variables from .env file
require('dotenv').config();

const cors = require('cors');
const express = require('express');
const session = require('express-session');
const { sequelize, User, UserConfig, UserWallet } = require('./models');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwt = require('jsonwebtoken');
const { PUBLIC_PROPERTIES } = require('./utils/constants');
const { Op } = require('sequelize');

// List of allowed origins
const allowedOrigins = [
    'http://localhost:8100',
    'http://localhost:3002',
    'http://localhost:5173',
    process.env.UI_ENDPOINT
];

// CORS configuration function
const corsOptions = {
    origin: (origin, callback) => {
        if (allowedOrigins.includes(origin) || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true // Allow credentials (cookies, authorization headers, etc.)
};

// Initialize Express app
const app = express();
app.use(cors(corsOptions));

// Set up body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

sequelize
    .authenticate()
    .then(() => console.log('Database connected...'))
    .catch((err) => console.log('Error: ' + err));

// Set up session store
const sessionStore = new SequelizeStore({
    db: sequelize,
    tableName: 'Sessions'
});

app.use(
    session({
        secret: process.env.SECRET,
        store: sessionStore,
        resave: false,
        saveUninitialized: false,
        cookie: { secure: process.env.UI_SSL === 'true' } // Set to true if using HTTPS
    })
);
sessionStore.sync();

app.set('trust proxy', 1);
app.use(passport.initialize());
app.use(passport.session());

// Passport.js serialization and deserialization
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findByPk(id)
        .then((user) => done(null, user))
        .catch((err) => done(err, null));
});

const opts = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET
};

passport.use(
    new JwtStrategy(opts, (jwtPayload, done) => {
        User.findByPk(jwtPayload.id)
            .then((user) => {
                if (user) {
                    return done(null, user);
                }
                return done(null, false);
            })
            .catch((err) => done(err, false));
    })
);

app.get('/auth/check', async (req, res, next) => {
    const authEnabledConfig = await UserConfig.findOne({
        where: {
            option: 'auth_enabled'
        }
    });
    const isAuthEnabled =
        authEnabledConfig && authEnabledConfig.value.toLowerCase() === 'true';

    if (!isAuthEnabled) {
        let user = {};
        user.config = await UserConfig.findAll({
            where: {
                option: {
                    [Op.in]: PUBLIC_PROPERTIES
                }
            }
        });
        return res.json({ authenticated: false, user: user });
    }

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        passport.authenticate(
            'jwt',
            { session: false },
            async (err, user, info) => {
                if (err) return next(err);
                if (!user) {
                    return res
                        .status(401)
                        .json({ authenticated: false, user: null });
                }
                const userDB = await User.findOne({
                    where: { username: user.username }
                });
                const { password, ...safeUser } = userDB.dataValues;
                safeUser.config = await userDB.config();
                return res.json({ authenticated: true, user: safeUser });
            }
        )(req, res, next);
    } else {
        if (req.isAuthenticated()) {
            const user = await User.findOne({
                where: { username: req.user.username }
            });
            const { password, ...safeUser } = user.dataValues;
            safeUser.config = await user.config();
            return res.json({ authenticated: true, user: safeUser });
        }
        return res.status(401).json({ authenticated: false, user: null });
    }
});

app.get('/auth/wallets', async (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (authHeader && authHeader.startsWith('Bearer ')) {
        // Verify the token using Passport's JWT strategy
        passport.authenticate(
            'jwt',
            { session: false },
            async (err, user, info) => {
                try {
                    if (err) {
                        return next(err);
                    }
                    if (!user) {
                        return res
                            .status(401)
                            .json({ authenticated: false, user: null });
                    }

                    // Fetch the user from the database
                    const userDB = await User.findOne({
                        where: { username: user.username }
                    });
                    if (!userDB) {
                        return res.status(404).json({
                            authenticated: false,
                            message: 'User not found'
                        });
                    }

                    // Fetch the user's wallets
                    const wallets = await UserWallet.findAll({
                        where: {
                            user_id: userDB.id
                        }
                    });

                    // Prepare a safe version of the user object
                    const { password, ...safeUser } = user.dataValues;
                    safeUser.config = await user.config();

                    // Send the final response
                    return res.json({
                        authenticated: true,
                        user: safeUser,
                        wallets
                    });
                } catch (error) {
                    console.error(
                        'Error occurred during authentication:',
                        error
                    );
                    return next(error);
                }
            }
        )(req, res, next);
    } else {
        if (req.isAuthenticated()) {
            const user = await User.findOne({
                where: { username: req.user.username }
            });
            const wallets = await UserWallet.findAll({
                where: {
                    user_id: user.id
                }
            });
            const { password, ...safeUser } = user.dataValues;
            safeUser.config = await user.config();
            return res.json({ authenticated: true, user: safeUser, wallets });
        }
        return res.status(401).json({ authenticated: false, user: null });
    }
});

app.get('/auth/params/public', async (req, res, next) => {
    const config = await UserConfig.findAll({
        where: {
            option: {
                [Op.in]: PUBLIC_PROPERTIES
            }
        }
    });
    return res.json({ config });
});

app.post('/login', (req, res, next) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res
                .status(400)
                .json({ message: 'Username and password are required' });
        }

        User.findOne({ where: { username } })
            .then((user) => {
                if (!user || !user.validPassword(password)) {
                    return res
                        .status(401)
                        .json({ message: 'Invalid credentials' });
                }
                req.login(user, async (err) => {
                    if (err) {
                        return next(err);
                    }
                    const token = jwt.sign(
                        { id: user.id },
                        process.env.JWT_SECRET,
                        { expiresIn: '1h' }
                    );

                    const { password, ...safeUser } = user.dataValues;
                    safeUser.config = await user.config();

                    res.json({
                        message: 'Login successful',
                        token,
                        user: safeUser
                    });
                });
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ message: 'Internal server error' });
            });
    } catch (e) {
        console.error(e);
    }
});

app.post('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.session.destroy((err) => {
            if (err) {
                return next(err);
            }
            res.clearCookie('connect.sid');
            res.json({ message: 'Logout successful' });
        });
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Authentication service is running on port ${PORT}`);
});
