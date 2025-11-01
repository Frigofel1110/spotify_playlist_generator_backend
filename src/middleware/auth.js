//Middleware pour protéger les routes
function requireAuth(req, res, next) {

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startWith('Bearer ')) {
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
  if (!req.session.user) {
    console.log(req.session);
    return res.status(401).json({
      error: "Authentication requires",
      redirectTo: "/auth/login",
    });
  }

  //Vérifier la validité du token
  if (Date.now() >= req.session.user.expiresAt) {
    return res.status(401).json({
      error: "Token expiré",
      redirectTo: "auth/login",
    });
  }

  //Tout ok, continuer
  next();
}

module.exports = requireAuth;
