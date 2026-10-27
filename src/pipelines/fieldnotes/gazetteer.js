// Places the gate recognises without asking. A name outside this list is not
// rejected; it is sent back to the caseworker to confirm the spelling. Our
// Apertus red-teaming found Cameroonian town names were the ones transcription
// garbled (4/20 right, against 15/20 for French and Swiss towns), and that the
// model never flagged its doubt. This list is where that doubt comes from.
//
// Real towns, used only as places: no case data is stored here.
export const PLACES = [
  // Cameroon
  'Yaoundé', 'Douala', 'Bamenda', 'Bafoussam', 'Garoua', 'Maroua', 'Ngaoundéré', 'Bertoua',
  'Ebolowa', 'Kribi', 'Limbe', 'Buea', 'Kumba', 'Edéa', 'Nkongsamba', 'Dschang', 'Foumban',
  'Kousseri', 'Mokolo', 'Mora', 'Yagoua', 'Kaélé', 'Guider', 'Meiganga', 'Garoua-Boulaï',
  'Batouri', 'Abong-Mbang', 'Sangmélima', 'Mbalmayo', 'Bonabéri', 'Domayo', 'Tibati', 'Banyo',
  'Mamfe', 'Wum', 'Kumbo', 'Bafang', 'Mbouda', 'Yokadouma', 'Lolodorf',
  // Neighbours and regional hubs
  "N'Djamena", 'Moundou', 'Abéché', 'Bangui', 'Berbérati', 'Libreville', 'Malabo', 'Bata',
  'Brazzaville', 'Kinshasa', 'Lagos', 'Abuja', 'Kano', 'Maiduguri', 'Calabar', 'Niamey', 'Diffa'
];
