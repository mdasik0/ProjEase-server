const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET_KEY;
const REFRESH_TOKEN_SECRET_KEY = process.env.JWT_REFRESH_SECRET_KEY; 

const generateAccessToken = (payload) => {
    return jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });
};

const generateRefreshToken = (payload) => {
    return jwt.sign(payload, REFRESH_TOKEN_SECRET_KEY, { expiresIn: '30d' }); 
};

const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, SECRET_KEY);
    } catch (error) {
        return null;
    }
};

const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, REFRESH_TOKEN_SECRET_KEY);
    } catch (error) {
        return null;
    }
};

module.exports = { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken };
