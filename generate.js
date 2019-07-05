#! /usr/bin/env node

const axios = require("axios");
const cheerio = require("cheerio");
const Feed = require("feed");
const path = require("path");
const fs = require("fs");
const promisify = require("util").promisify;
const writeFileAsync = promisify(fs.writeFile);

const feeds = {};

feeds.master = new Feed.Feed({
  title: "Image Comics",
  description: "Unoffical Image Comics rss master feed",
  link: "https://rss.jneidel.com/image/master",
});
feeds.press = new Feed.Feed({
  title: "Image Comics Press Releases",
  description: "Unoffical Image Comics rss press releases feed",
  link: "https://rss.jneidel.com/image/press",
});
feeds.news = new Feed.Feed({
  title: "Image Comics News",
  description: "Unoffical Image Comics rss news feed",
  link: "https://rss.jneidel.com/image/news",
});
feeds.solicitations = new Feed.Feed({
  title: "Image Comics Solicitations",
  description: "Unoffical Image Comics rss solicitations feed",
  link: "https://rss.jneidel.com/image/solicitations",
});
feeds.features = new Feed.Feed({
  title: "Image Comics Features",
  description: "Unoffical Image Comics rss features feed",
  link: "https://rss.jneidel.com/image/features",
});

Object.keys(feeds).forEach(name => {
  feeds[name].author = {
    name: "Image Comics",
    link: "https://imagecomics.com/news",
  };
  feeds[name].id = feeds[name].link;

  feeds[name].addContributor({
    name: "Jonathan Neidel",
    email: "image-rss@jneidel.com",
    link: "https://rss.jneidel.com",
  });
});

(async () => {
  for (const url of [
    "https://imagecomics.com/news",
    "https://imagecomics.com/news/p2",
  ]) {
    await axios
      .get(url)
      .then(html => cheerio.load(html.data))
      .then(async $ => {
        const h2s = $("h2", "main");
        const keys = Object.keys(h2s)
          .filter(x => Number(x))
          .map(x => Number(x));
        keys.unshift(0);

        for (const key of keys) {
          const a = h2s[key].children.filter(child => child.name === "a")[0];
          const dateStr = h2s[key].parent.children
            .filter(child => child.name === "span")[0]
            .children[0].data.replace(/\|.*/, "")
            .trim();

          const category = h2s[key].parent.children.filter(
            child => child.name === "h5",
          )[0].children[0].data;

          const date = new Date(Date.parse(dateStr));
          const href = a.attribs.href;
          const title = a.children[0].data.trim();

          console.log(`${category}:`, title);

          const content = await axios
            .get(href)
            .then(html => cheerio.load(html.data))
            .then($ => {
              const ps = $("p", "main");
              const keys = Object.keys(ps)
                .filter(x => Number(x))
                .map(x => Number(x));
              keys.unshift(0);
              const texts = keys.map(key => {
                const text = ps[key].children
                  .filter(child => child.type === "text")
                  .reduce((acc, cur) => {
                    return `${cur.data}
${acc}`;
                  }, "");
                return text;
              });
              texts.shift(); // Remove date
              return texts.join("<br><br>");
            });

          function getFeed(category) {
            switch (category) {
              case "Press Releases":
                return feeds.press;
                break;
              case "News":
                return feeds.news;
                break;
              case "Solicitations":
                return feeds.solicitations;
                break;
              case "Features":
                return feeds.features;
                break;
            }
          }

          const feedObj = {
            title,
            date,
            content,
            id: href,
            link: href,
          };
          const feed = getFeed(category);

          feed.addItem(feedObj);
          feeds.master.addItem(feedObj);
        }
      });

    // console.log( feed.rss2() )
    Object.keys(feeds).forEach(name => {
      const out = path.resolve(__dirname, name);
      const feedData = feeds[name].rss2();

      writeFileAsync(out, feedData);
    });
  }
})();
