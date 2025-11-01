//Middleware pour protéger les routes
function requireAuth(req, res, next) {

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());

      if (Date.now() < decoded.expiresAt) {
        req.user = decoded;
        return next();
      } else {
        return res.status(401).json({
          error: 'Token expiré',
          redirectTo: '/',
        });
      }
    } catch (error) {
      return res.status(401).json({
        error: 'Token invalide',
        redirectTo: '/'
      })
    }
  }
 //Vérifier si l'utilisateur est connecté
if (req.session && req.session.user) {
  // Vérifier la validité du token
  if (Date.now() < req.session.user.expiresAt) {
    req.user = req.session.user;  // ⭐ AJOUTER CETTE LIGNE
    return next();
  } else {
    return res.status(401).json({
      error: "Token expiré",
      redirectTo: "/",
    });
  }
}

// Aucune authentification valide
return res.status(401).json({
  error: "Authentication requise",
  redirectTo: "/",
});
}

module.exports = requireAuth;
