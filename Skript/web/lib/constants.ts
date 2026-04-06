// Re-Export der zentralen Konstanten aus shared/ — bestehende Web-Imports
// funktionieren unverändert. FAECHER ist ein Alias für ALLGEMEINE_FAECHER.
export {
  ALLE_HALBJAHRE,
  ALLGEMEINE_FAECHER as FAECHER,
  ALLGEMEINE_FAECHER,
  AUSBILDUNGSJAHRE,
  FACH_LABELS,
  fachStunden,
  HALBJAHR_MAP,
  LERNFELDER,
  STUNDEN_GRENZEN,
} from '../../shared/constants'
