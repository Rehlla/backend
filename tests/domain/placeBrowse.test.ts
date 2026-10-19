import { describe, expect, it } from 'vitest';
import { browseRestaurants, browseStays } from '../../src/shared/placeBrowse';

const PHOTO = 'https://dynamic-media-cdn.tripadvisor.com/media/photo.jpg?w={width}&h={height}&s=1';

const readyStay = {
  id: 3410707,
  name: 'Siwa Shali Resort',
  url: '/Hotel_Review-g303857-d3410707-Reviews-Siwa_Shali_Resort.html',
  rating: 3.8,
  reviewCount: 111,
  type: 'Hotel',
  lat: 29.177671,
  lng: 25.554668,
  address: { locality: 'Siwa' },
  priceMin: 2420,
  priceUSDMin: 46,
  photo: PHOTO,
};

describe('place browse selectors', () => {
  it('keeps a stay only when it has a photo, a real rating, a listed price and coordinates inside the place', () => {
    const [stay] = browseStays('siwa', [readyStay]);
    expect(stay).toMatchObject({
      id: '3410707',
      name: 'Siwa Shali Resort',
      rating: 3.8,
      locality: 'Siwa',
      bookable: false,
      lat: 29.177671,
    });
    expect(stay.photoUrl).toContain('w=800');
    expect(stay.photoUrl).not.toContain('{width}');
    expect(stay.url).toBe('https://www.tripadvisor.com/Hotel_Review-g303857-d3410707-Reviews-Siwa_Shali_Resort.html');
    expect(stay).not.toHaveProperty('priceMin');
  });

  it('drops a stay whose coordinates are in another country, and a stay with no photo or a zero rating', () => {
    const rows = browseStays('dahab', [
      { ...readyStay, id: 1, lat: 4.63, lng: -74.09 },
      { ...readyStay, id: 2, photo: null },
      { ...readyStay, id: 3, rating: 0, lat: 28.5, lng: 34.51 },
      { ...readyStay, id: 4, priceMin: null, priceUSDMin: null, lowestPrice: null, priceRange: null, lat: 28.5, lng: 34.51 },
    ]);
    expect(rows).toEqual([]);
  });

  it('puts a duplicated camp in the destination its coordinates fall in', () => {
    const eden = {
      ...readyStay,
      id: 34411251,
      name: 'Eden Camp Abu Galum',
      lat: 28.73,
      lng: 34.6,
    };
    expect(browseStays('dahab', [eden])).toEqual([]);
    expect(browseStays('nuweiba', [eden])).toHaveLength(1);
  });

  it('lists a restaurant by name, kitchen and public rating, with no photo and no order', () => {
    const [restaurant] = browseRestaurants('siwa', [{
      id: 23209797,
      name: 'Ola restaurant',
      rating: '4.9',
      reviewCount: 81,
      priceRange: '$$ - $$$',
      cuisines: 'Italian, Mediterranean',
      reviews: [{ text: '  The restaurant is very nice.  ' }],
    }]);
    expect(restaurant).toEqual({
      id: 'siwa:23209797',
      name: 'Ola restaurant',
      rating: 4.9,
      reviewCount: 81,
      cuisines: ['Italian', 'Mediterranean'],
      priceBand: '$$ - $$$',
      quote: 'The restaurant is very nice.',
      orderable: false,
    });
    expect(restaurant).not.toHaveProperty('photoUrl');
    expect(restaurant).not.toHaveProperty('phone');
  });

  it('keeps an unreviewed restaurant and does not treat rating 0 as a score', () => {
    const [restaurant] = browseRestaurants('nuweiba', [{ id: 9, name: 'Camp kitchen', rating: 0, priceRange: 'EGPEGP' }]);
    expect(restaurant.rating).toBeNull();
    expect(restaurant.priceBand).toBeNull();
  });
});
