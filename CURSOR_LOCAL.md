# Guide Cursor en local

Informations de base pour développer et tester l'application CRM Famille avec Cursor en environnement local.

---

## Serveur local

### Démarrer le serveur

**Option 1 : Python (port 8080)**

```powershell
cd "c:\Users\bob.DESKTOP-DAOCA59\Documents\Divers\Application Disciples\crm-famille-eglise-main"
python -m http.server 8080
```

Puis ouvrir : **http://localhost:8080**

---

**Option 2 : npx serve (port 3000)**

```powershell
cd "c:\Users\bob.DESKTOP-DAOCA59\Documents\Divers\Application Disciples\crm-famille-eglise-main"
npx --yes serve -l 3000
```

Puis ouvrir : **http://localhost:3000**

---

### Terminal « bloqué » pendant que le serveur tourne

Le serveur s'exécute **au premier plan** et affiche les requêtes HTTP. Le terminal n'est pas bloqué : il est simplement occupé par le processus serveur.

**Pour taper de nouvelles commandes tout en gardant le serveur actif :**

- Ouvrir un **nouveau terminal** : `Ctrl+Shift+ù` ou menu **Terminal → New Terminal**
- Ou cliquer sur le **+** dans la barre des onglets du terminal

Le serveur continue dans l'ancien terminal ; le nouveau permet d'exécuter d'autres commandes.

---

### Arrêter le serveur

Dans le terminal où le serveur tourne, appuyer sur **Ctrl+C**. Le serveur s'arrête et le terminal redevient disponible.

---

### Lancer le serveur en arrière-plan (optionnel)

Pour libérer le terminal tout en gardant le serveur actif :

**Avec Python :**

```powershell
Start-Process python -ArgumentList "-m", "http.server", "8080" -NoNewWindow
```

**Avec npx serve :**

```powershell
cd "c:\Users\bob.DESKTOP-DAOCA59\Documents\Divers\Application Disciples\crm-famille-eglise-main"
Start-Process npx -ArgumentList "--yes", "serve", "-l", "3000" -NoNewWindow
```

---

## Raccourcis utiles Cursor

| Action | Raccourci |
|--------|-----------|
| Nouveau terminal | `Ctrl+Shift+ù` |
| Rechercher dans les fichiers | `Ctrl+Shift+F` |
| Palette de commandes | `Ctrl+Shift+P` |
| Ouvrir le chat IA | `Ctrl+L` |

---

## Notes

- **Firebase** : L'application se connecte à Firebase (Firestore, Auth). Vérifier que `firebase-config.js` est correctement configuré.
- **Images / logos** : En `file://`, certains navigateurs bloquent les images. Utiliser un serveur local pour un affichage correct.
- **Git** : Voir `GIT_GUIDE.md` pour les commandes Git et le déploiement.

---

## Chargement lent en local ?

Si le rechargement (F5) est anormalement long :

1. **Bloqueurs et confidentialité** : Désactivez les bloqueurs de publicité (ABP, etc.) et la « prévention du suivi » pour `localhost` dans les paramètres du navigateur (Chrome : Paramètres → Confidentialité et sécurité → Cookies et autres données de site → Gérer les exceptions).
2. **Extensions** : Testez en navigation privée ou avec les extensions désactivées.
3. **Réseau** : Vérifiez que Firebase (auth, Firestore) est accessible. Un VPN ou un pare-feu peut ralentir les requêtes.
4. **Console (F12)** : Vérifiez les erreurs réseau (onglet Network) et les messages en rouge dans la console.
