//Middleware pour protéger les routes
function requireAuth(req, res, next) {
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
