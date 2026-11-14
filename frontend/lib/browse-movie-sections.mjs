const genreMatches = (movie, terms) => {
  const genres = Array.isArray(movie.genres) ? movie.genres : [];
  return genres.some((genre) => {
    const normalized = String(genre).toLowerCase().replace(/[^a-z]/g, "");
    return terms.some((term) => normalized.includes(term));
  });
};

const viewsDescending = (left, right) => (right.views || 0) - (left.views || 0);
const releaseDateDescending = (left, right) => {
  const dateOf = (movie) => Date.parse(movie.releaseDate || movie.createdAt || "") || 0;
  return dateOf(right) - dateOf(left) || (right.year || 0) - (left.year || 0);
};

export const buildBrowseMovieSections = (movies) => {
  const catalog = Array.isArray(movies) ? movies : [];
  const rows = [
    { title: "Trending Now", movies: [...catalog].sort(viewsDescending).slice(0, 20) },
    { title: "Popular on Netflix", movies: [...catalog].sort(releaseDateDescending).slice(0, 20) },
    { title: "Sci-Fi & Future", movies: catalog.filter((movie) => genreMatches(movie, ["scifi", "sciencefiction"])) },
    { title: "Horror Nights", movies: catalog.filter((movie) => genreMatches(movie, ["horror"])) },
    { title: "Action & Adventure", movies: catalog.filter((movie) => genreMatches(movie, ["action", "adventure"])) },
    { title: "Critically Acclaimed Dramas", movies: catalog.filter((movie) => genreMatches(movie, ["drama"])) },
  ];
  const topTen = catalog.filter((movie) => movie.isTop10).sort(viewsDescending).slice(0, 10);

  return {
    topTen,
    rows: rows.filter((row) => row.movies.length > 0),
  };
};
