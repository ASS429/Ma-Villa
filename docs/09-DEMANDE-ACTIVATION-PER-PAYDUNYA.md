# Demande d'activation PER / Déboursement — PayDunya

> À envoyer au support PayDunya, de préférence depuis un ticket ouvert dans votre
> tableau de bord marchand (la demande est alors rattachée à votre compte, ce qui
> évite un aller-retour d'identification). Confirmez l'adresse du support dans
> votre espace avant d'envoyer par courriel.
>
> **À compléter avant envoi** : les deux estimations de volume, dans le tableau
> (une fourchette approximative suffit — le support veut situer l'ordre de
> grandeur, pas un engagement).
>
> **Facultatif** : l'identifiant marchand `BSN…`, dans la dernière ligne du
> tableau. Il se trouve dans votre tableau de bord PayDunya, du côté des clés
> d'API de l'application. Si vous ne le trouvez pas, **supprimez la ligne** :
> un ticket ouvert depuis votre espace identifie déjà le compte.

---

## Objet

`Demande d'activation de l'API PER / Déboursement — application « Ma Villa »`

---

## Corps du message

Bonjour,

Je vous écris au sujet de notre compte marchand, application
**« Ma Villa »**, ouvert au nom de **Arfang Souleymane Sané**.

Nous exploitons Ma Villa, une place de marché de location de villas et de
logements de vacances au Sénégal. L'encaissement passe déjà par PayDunya : nous
utilisons **WebPay** et **SoftPay** (Wave et Orange Money Sénégal) en production,
et cela fonctionne.

Notre modèle est celui d'une place de marché : nous encaissons la totalité du
séjour auprès du client, nous retenons une commission, puis nous **reversons sa
part au propriétaire du logement** une fois le séjour terminé. C'est ce
reversement que nous souhaitons automatiser.

**Notre demande : activer l'option « Paiement Et Redistribution » (PER /
Déboursement) sur notre compte, pour WebPay et pour MobPay.**

À ce jour, un appel à `POST https://app.paydunya.com/api/v2/disburse/get-invoice`
avec nos clés de production nous renvoie :

```
{ "response_code": "401", "response_text": "Initiation not authorize" }
```

ce qui, d'après votre documentation, correspond bien à une option non activée
côté compte.

### Ce que nous prévoyons d'utiliser

| | |
|---|---|
| **Endpoints** | `disburse/get-invoice`, `disburse/submit-invoice`, `disburse/check-status` (API v2) |
| **`withdraw_mode`** | `wave-senegal`, `orange-money-senegal`, et si possible `free-money-senegal` |
| **Bénéficiaires** | les propriétaires de logements inscrits sur notre plateforme, vers leur portefeuille mobile |
| **URL de rappel** | `https://ma-villa-production.up.railway.app/api/reversements/rappel` |
| **Volume attendu** | [À REMPLIR — ex. : 20 à 50 déboursements par mois au démarrage] |
| **Montant moyen** | [À REMPLIR — ex. : entre 30 000 et 300 000 FCFA par versement] |
| **Identifiant marchand** | [FACULTATIF — `BSN…`, ou supprimer cette ligne] |

L'URL de rappel est publique, accessible depuis l'extérieur, et vérifie la
signature SHA-512 de notre clé maîtresse conformément à votre documentation.
Notre intégration est terminée et testée côté serveur ; elle n'attend que votre
autorisation.

### Nos questions

1. Quelles **pièces ou vérifications** vous faut-il de notre part pour activer
   l'option (documents d'entreprise, contrat, conformité) ?
2. Y a-t-il un **solde minimum** à maintenir sur le compte marchand pour que les
   déboursements aboutissent, et comment l'approvisionner ?
3. Des **frais** s'appliquent-ils par déboursement, et si oui selon quel barème
   par `withdraw_mode` ?
4. Existe-t-il un **plafond** par transaction ou par jour ?
5. L'option peut-elle être activée d'abord en **environnement de test**, afin que
   nous validions le parcours de bout en bout avant de verser de l'argent réel ?

Nous restons à votre disposition pour tout complément, et pouvons vous
communiquer un jeton de transaction à des fins de diagnostic si cela vous est
utile.

Bien cordialement,

**Arfang Souleymane Sané**
Développeur — Ma Villa
+221 78 157 10 09 · sanarfang429@gmail.com
https://mavilla-web.onrender.com

---

## Une fois la réponse reçue

1. Poser `REVERSEMENT_AUTOMATIQUE=true` dans les variables Railway.
2. Lancer la sonde **Console d'administration → Déboursement**. Elle demande un
   jeton et s'arrête là : aucun argent ne peut partir. Un verdict vert confirme
   l'activation.
3. Faire un premier versement réel de faible montant vers un numéro que vous
   contrôlez, puis vérifier qu'il apparaît « Versé » dans la file d'attente.

⚠️ Un code **`4002`** après activation ne signifie pas un refus d'autorisation :
c'est soit un **solde insuffisant** sur le compte marchand, soit une **URL de
rappel injoignable**. Vérifier le solde en premier.
