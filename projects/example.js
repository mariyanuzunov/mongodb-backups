export default {
  STATUS: 'enabled',
  DELETE_LOCAL_COPY: false, // delete local copy after upload
  CRON: '30 21 * * 7', // every sunday at 21:30
  DB_URI: 'mongodb://<username>:<password>...',
  S3_REGION: 'eu-central-1',
  S3_BUCKET: 'foo',
  S3_ACCESS_KEY: 'abcdf',
  S3_SECRET_KEY: 'abcdf'
}
