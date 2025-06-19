const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET_KEY;
const REFRESH_TOKEN_SECRET_KEY = process.env.JWT_REFRESH_SECRET_KEY; 

const generateAccessToken = (payload) => {
    return jwt.sign(payload, SECRET_KEY, { expiresIn: '3hr'});
};

const generateRefreshToken = (payload) => {
    return jwt.sign(payload, REFRESH_TOKEN_SECRET_KEY, { expiresIn: '30d' }); 
};

const verifyAccessToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
  
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Access denied. No token provided." });
    }
  
    const token = authHeader.split(" ")[1];
  
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(403).json({ success: false, error: "Invalid or expired token." });
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
