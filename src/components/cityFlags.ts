/**
 * Dedicated flag images for the curated cities, so the popular-city chips never
 * depend on the device emoji font (which can draw flag codepoints
 * inconsistently). Maps city id → bundled PNG. Cities without an image (live
 * autocomplete results) simply fall back to no flag / the 📍 marker.
 */
import type { ImageSourcePropType } from 'react-native';

const FLAGS: Record<string, ImageSourcePropType> = {
  lisbon: require('../../assets/images/flags/pt.png'),
  paris: require('../../assets/images/flags/fr.png'),
  rome: require('../../assets/images/flags/it.png'),
  barcelona: require('../../assets/images/flags/es.png'),
  tokyo: require('../../assets/images/flags/jp.png'),
  amsterdam: require('../../assets/images/flags/nl.png'),
};

export function flagFor(cityId: string | undefined): ImageSourcePropType | undefined {
  return cityId ? FLAGS[cityId] : undefined;
}
