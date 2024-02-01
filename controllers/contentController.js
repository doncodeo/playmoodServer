
const asyncHandler = require ('express-async-handler');
const contentSchema = require('../models/contentModel');
const userSchema = require('../models/userModel')
const cloudinary = require('../config/cloudinary');

const Test = "Working Here"



// @desc Get Content
// @route GET /api/content
// @access Private

const getContent = asyncHandler(async (req, res) => {
    console.log('Fetching content...');
    const content = await contentSchema.find();
    // console.log('Fetched content:', content);
    res.status(200).json(content);
});


// @desc Post Content
// @route POST /api/content

const createContent = asyncHandler(async (req, res) => {
  try {
      const { title, category, description, credit } = req.body;

      // Check if required fields are missing
      if (!title || !category || !description || !credit) {
          return res.status(400).json({ error: 'Important fields missing!' });
      }

      // Upload video to Cloudinary
      const cloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
          resource_type: 'video',
          folder: "contents"
      });

      // Set default values for profileImage and cloudinary_id
      const defaultProfileImage = 'https://res.cloudinary.com/di97mcvbu/image/upload/v1705254137/contents/raiwsn8fpx870pboiodp.png'; // Replace with your default image URL
      const defaultCloudinaryId = 'contents/raiwsn8fpx870pboiodp'; // Replace with your default cloudinary_id

      // Check if thumbnail is provided, otherwise set a default value
      const thumbnail = req.file ? cloudinaryResult.secure_url : defaultProfileImage;

      // Create content
      const content = await contentSchema.create({
          title,
          category,
          description,
          credit,
          thumbnail:defaultProfileImage,
          video: cloudinaryResult.secure_url,
          cloudinary_id: cloudinaryResult.public_id,
          thumnail_id: defaultCloudinaryId
      });

      if (content) {
          console.log('Content created:', content.video);
          res.status(201).json({
              _id: content._id,
              title: content.title,
              category: content.category,
              description: content.description,
              thumbnail: content.thumbnail,
              credit: content.credit,
              video: content.video,
              likes: content.likes,
              cloudinary_id: cloudinaryResult.public_id,
              thumnail_id: defaultCloudinaryId
          });
      } else {
          console.log('Content creation failed');
          res.status(400).json({ error: 'Invalid content data' });
      }

      console.log('Content creation completed');

  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
  }
});

// @desc Post Content
// @route POST /api/content/:id

const updateContent = asyncHandler(async (req, res) => {
    try {
        const contentId = req.params.id; // Assuming the user ID is passed as a parameter

        // Fetch the user from MongoDB
        const content = await contentSchema.findById(contentId);

        if (!content) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Update the thumbnail in Cloudinary
        const updatedCloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
            folder: 'contents',
            public_id: content._id, // Set public_id to a unique identifier like user._id
        });

        console.log(updatedCloudinaryResult)

        // If updating the thumbnail, delete the old thumbnail in Cloudinary
        if (content.cloudinary_id) {
            await cloudinary.uploader.destroy(content.cloudinary_id);

              // Update the user's profileImage and cloudinary_id
              content.thumbnail = updatedCloudinaryResult.secure_url;
              content.cloudinary_id = updatedCloudinaryResult.public_id;
        }

        // Update user data in MongoDB
        content.title = req.body.name || content.title;
        content.category = req.body.category || content.category;
        content.description = req.body.description || content.description;
        content.credit = req.body.credit || content.credit;
        content.thumbnail = req.body.thumbnail || content.thumbnail;
        content.video = req.body.video || content.video;
        content.likes = req.body.likes || content.likes;
        content.cloudinary_id = updatedCloudinaryResult.public_id;

        // Save the updated content in MongoDB
        const updatedContent = await content.save();

        res.status(200).json({
            message: 'content updated successfully',
            content: {
                _id: updatedContent._id,
                title: updatedContent.name,
                category: updatedContent.category,
                description: updatedContent.description,
                credit: updatedContent.credit,
                thumbnail: updatedContent.thumbnail,
                video: updatedContent.video,
                likes: updatedContent.likes,
                cloudinary_id: updatedContent.cloudinary_id, // Update the cloudinary_id
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});



// @desc Delete content
// @route DELETE /api/content/:id
const deleteContent = asyncHandler(async (req, res) => {
    const contentId = req.params.id;

    try {
        // Fetch the content details from MongoDB
        const content = await contentSchema.findById(contentId);
        console.log(content)
        if (!content) {
            return res.status(404).json({ error: 'Content not found' });
        }

        // Delete the video from Cloudinary
        const publicId = content.video && content.cloudinary_id;

        if (publicId) {
            await cloudinary.uploader.destroy(publicId);

        }

        // Delete the content from MongoDB
        await content.deleteOne();

        // console.log('Content deleted:', content);

        res.status(200).json({ message: 'Content deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});


 module.exports = {
    getContent,
    updateContent,
    createContent,
    deleteContent,
 }
