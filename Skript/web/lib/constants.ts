// Re-Export der zentralen Konstanten aus shared/ — bestehende Web-Imports
// funktionieren unverändert. FAECHER ist ein Alias für ALLGEMEINE_FAECHER.
export {
  ALLGEMEINE_FAECHER as FAECHER,
  ALLGEMEINE_FAECHER,
  ALLE_HALBJAHRE,
  AUSBILDUNGSJAHRE,
  FACH_LABELS,
  HALBJAHR_MAP,
  LERNFELDER,
  STUNDEN_GRENZEN,
  fachStunden,
} from '../../shared/constants'
