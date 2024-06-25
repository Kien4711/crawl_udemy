const { chromium } = require('playwright');
const knex = require('knex')({
  client: 'mysql',
  connection: {
    host: 'localhost',
    user: 'root',
    password: 'KienBT3',
    database: 'crawl_udemy'
  }
});
const db = require('./db');
const { generateJobId, saveLog } = require('./utils');

const BASE_URL = 'https://www.udemy.com/';

const login = async (page, email, password) => {
  try {
    await page.goto(BASE_URL, { waitUntil: 'load' });
    console.log('Navigated to Udemy homepage');

    await page.waitForSelector('a[data-purpose="header-login"]', { timeout: 60000 });
    console.log('Login button found');

    await page.click('a[data-purpose="header-login"]');
    console.log('Clicked login button');

    await page.waitForSelector('input[name="email"]', { timeout: 60000 });
    await page.fill('input[name="email"]', email);
    console.log('Email filled');

    await page.click('button[type="submit"]');
    console.log('Clicked submit button for email');

    await page.waitForSelector('input[name="password"]', { timeout: 60000 });
    await page.fill('input[name="password"]', password);
    console.log('Password filled');

    await page.click('button[type="submit"]');
    console.log('Clicked submit button for password');

    await page.waitForSelector('text=My courses', { timeout: 60000 });
    console.log('Successfully logged in');
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
};

const navigateToNodeJsCourses = async (page) => {
  try {
    await page.waitForSelector('button#popper-trigger--5', { timeout: 60000 });

    await page.hover('button#popper-trigger--5');
    console.log('Hovered over Categories');

    await page.waitForSelector('a[data-testid="browse-nav-item"]:has-text("Development")', { timeout: 60000 });
    await page.hover('a[data-testid="browse-nav-item"]:has-text("Development")');
    console.log('Hovered over Development');

    await page.waitForSelector('a[data-testid="browse-nav-item"]:has-text("Web Development")', { timeout: 60000 });
    await page.hover('a[data-testid="browse-nav-item"]:has-text("Web Development")');
    console.log('Hovered over Web Development');

    await page.waitForSelector('a[data-testid="browse-nav-item"]:has-text("Node.Js")', { timeout: 60000 });
    await page.click('a[data-testid="browse-nav-item"]:has-text("Node.Js")');
    console.log('Clicked on Node.Js');

    await page.waitForNavigation({ waitUntil: 'load' });
    console.log('Navigation to Node.Js page completed');
  } catch (error) {
    console.error('Navigation failed:', error);
    throw error;
  }
};

async function extractCourseData(page) {
  const courses = [];

  async function scrapeCurrentPage() {
    const courseItems = await page.$$eval('.course-card_container__urXwO', (cards) => {
      return cards.map(card => {
        const titleElement = card.querySelector('.course-card-title_course-title___sH9w a');
        const title = titleElement ? titleElement.innerText : null;
        const url = titleElement ? titleElement.href : null;
        const ratingElement = card.querySelector('.star-rating_rating-number__nHi2B');
        const rating = ratingElement ? ratingElement.innerText : null;
        const reviewsCountElement = card.querySelector('.course-card-ratings_reviews-text__rx1CN');
        const reviewsCount = reviewsCountElement ? reviewsCountElement.innerText.replace(/[\(\)]/g, '') : null;
        const durationElement = card.querySelector('.course-card-details_row__sWQ8g > span:first-child');
        const duration = durationElement ? durationElement.innerText : null;
        const levelElement = card.querySelector('.course-card-details_row__sWQ8g > span:last-child');
        const level = levelElement ? levelElement.innerText : null;
        const priceElement = card.querySelector('.course-card_price-text-base-price-text-component-discount-price__cZo6B span:last-child');
        const price = priceElement ? priceElement.innerText : null;
        const instructorsElement = card.querySelector('.course-card-instructors_instructor-list__helor');
        const instructors = instructorsElement ? instructorsElement.innerText : null;

        return {
          title,
          url,
          rating,
          reviewsCount,
          duration,
          level,
          price,
          instructors,
        };
      });
    });

    courses.push(...courseItems);
  }

  async function navigateToNextPage() {
    const nextButton = await page.$('a.pagination_next__aBqfT:not(.ud-btn-disabled)');
    if (nextButton) {
      await nextButton.click();
      await page.waitForNavigation();
      return true;
    } else {
      return false;
    }
  }

  await scrapeCurrentPage();

  const promises = [];
  while (await navigateToNextPage()) {
    promises.push(scrapeCurrentPage());
  }
  await Promise.all(promises);

  return courses;
}

const saveCourses = async (knex, courses) => {
  let totalNew = 0;
  let totalUpdate = 0;

  await knex.transaction(async (trx) => {
    for (const course of courses) {
      const { title, url, rating, reviewsCount, duration, level, price, instructors } = course;

      try {
        const existingCourse = await trx('courses')
          .where({ course_name: title })
          .first();

        if (existingCourse) {
          // Update the existing course
          await trx('courses')
            .where({ course_name: title })
            .update({
              description: url,
              url_img: '',
              author: instructors,
              rating: rating,
              price: price,
              total_time: duration,
              lectures: '',
              level: level,
              ts_update: knex.fn.now()
            });
          totalUpdate += 1;
        } else {
          // Insert the new course
          await trx('courses').insert({
            course_name: title,
            description: url,
            url_img: '', // Add logic to handle URL image if available
            author: instructors,
            rating: rating,
            price: price,
            total_time: duration,
            lectures: '', // Add logic to handle lectures if available
            level: level,
            ts_update: knex.fn.now()
          });
          totalNew += 1;
        }
      } catch (error) {
        console.error('Error saving course:', error);
      }
    }
  });

  return { totalNew, totalUpdate };
};

(async () => {
  const browser = await chromium.launch({ headless: false }); // Run in headful mode
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();
  await page.setDefaultTimeout(60000);

  const jobId = generateJobId();
  const startTime = new Date();

  try {
    await page.goto(BASE_URL, { waitUntil: 'load' });
    console.log('Successfully navigated to Udemy homepage');

    // Step 1: Save log start job
    await saveLog(db, jobId, null, null, 1, null);

    // Step 2: Login
    // await login(page, 'training.newmember01@gmail.com', 'Qh34!8fh@1');

    // Step 3: Navigate to the target page
    await navigateToNodeJsCourses(page);

    // Step 4: Extract course data
    const courses = await extractCourseData(page);

    // Step 5: Save course data to database
    const { totalNew, totalUpdate } = await saveCourses(knex, courses);

    const endTime = new Date();

    // Step 6: Save job result log
    const detail = {
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      detail: {
        total_crawl: courses.length,
        total_new: totalNew,
        total_update: totalUpdate,
      },
    };

    await saveLog(db, jobId, 1, 'Thành công', 2, detail);
  } catch (error) {
    console.error('Error:', error);

    const endTime = new Date();
    const detail = {
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      detail: {
        total_crawl: 0,
        total_new: 0,
        total_update: 0,
      },
    };

    await saveLog(db, jobId, 0, 'Thất bại', 2, detail);
  } finally {
    // Step 7: Save log end job
    await saveLog(db, jobId, null, null, 3, null);

    if (browser) {
      await browser.close();
    }
    knex.destroy();
    db.end((err) => {
      if (err) {
        console.error('Error ending database connection:', err.stack);
      } else {
        console.log('Database connection closed.');
      }
    });
  }
})();
