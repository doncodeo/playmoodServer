
const asyncHandler = require ('express-async-handler');
const contentSchema = require('../models/contentModel');
const cloudinary = require('../config/cloudinary');


// @desc Get Content
// @route GET /api/content
// @access Private

const getContent = asyncHandler(async (req, res) => {
    console.log('Fetching content...');
    const content = await contentSchema.find();
    console.log('Fetched content:', content);
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
    const videoCloudinaryResult = await cloudinary.uploader.upload(req.files.video.path, {
      resource_type: 'video',
      folder: "contents",
    });

    // Upload image to Cloudinary (if provided)
    let imageCloudinaryResult;
    if (req.files.image) {
      imageCloudinaryResult = await cloudinary.uploader.upload(req.files.image.path, {
        resource_type: 'image',
        folder: "contents",
      });
    }

    // Set default values for profileImage and cloudinary_id
    const defaultProfileImage = 'https://res.cloudinary.com/di97mcvbu/image/upload/v1705254137/contents/raiwsn8fpx870pboiodp.png';
    const defaultCloudinaryId = 'contents/raiwsn8fpx870pboiodp';

    // Check if thumbnail is provided, otherwise set a default value
    const thumbnail = imageCloudinaryResult ? imageCloudinaryResult.secure_url : defaultProfileImage;

    // Create content
    const content = await contentSchema.create({
      title,
      category,
      description,
      credit,
      thumbnail,
      video: videoCloudinaryResult.secure_url,
      cloudinary_id: videoCloudinaryResult.public_id,
      thumbnail_id: imageCloudinaryResult ? imageCloudinaryResult.public_id : defaultCloudinaryId,
      image: imageCloudinaryResult ? imageCloudinaryResult.secure_url : null,
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
        image: content.image,
        likes: content.likes,
        cloudinary_id: content.cloudinary_id,
        thumbnail_id: content.thumbnail_id,
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


// authenticated user
// const createContent = asyncHandler(async (req, res) => {
//     try {
//         const { title, category, description, thumbnail, credit } = req.body;

//         // Check if required fields are missing
//         if (!title || !category || !description || !thumbnail || !credit) {
//             return res.status(400).json({ error: 'Important fields missing!' });
//         }

//         // Assuming you have the user ID available (you need to obtain this from your authentication logic)
//         const userId = req.user._id; // Assuming you have user information in the request object

//         // Upload video to Cloudinary
//         const cloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
//             resource_type: 'video',
//             folder: 'content',
//         });

//         // Create content with user ID
//         const content = await Content.create({
//             user: userId,
//             title,
//             category,
//             description,
//             thumbnail,
//             credit,
//             video: cloudinaryResult.secure_url,
//         });

//         if (content) {
//             console.log('Content created:', content.title);
//             console.log(cloudinaryResult);
//             res.status(201).json({
//                 _id: content._id,
//                 title: content.title,
//                 category: content.category,
//                 description: content.description,
//                 thumbnail: content.thumbnail,
//                 credit: content.credit,
//                 video: content.video,
//                 likes: content.likes,
//             });
//         } else {
//             console.log('Content creation failed');
//             res.status(400).json({ error: 'Invalid content data' });
//         }

//         console.log('Content creation completed');
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Server error' });
//     }
// });


// @desc Like a post
// @route UPDATE /api/like/ {postId,userId}
// @access Private

const postLikes = asyncHandler(async (req, res) => {
    try {
        const likeId = req.body.postId;
        const userId = req.body.userId;

        const content = await contentSchema.findOne({ _id: likeId, likes: userId });
 
        if (content) {
            return res.status(400).json({ error: 'This User already liked this content' });
        }

        // Find the content by ID and update the likes array
        const updatedContent = await contentSchema.findOneAndUpdate(
            { _id: likeId }, // Query to find the document by its _id
            { $push: { likes: userId } }, // Update to push the likeId to the likes array
            { new: true } // Option to return the modified document
        );

        res.status(200).json({ likes: updatedContent.likes }); // Send the updated likes array in the response
    } catch (error) {
        console.error(error); // Log any errors to the console for debugging
        res.status(500).json({ error: 'Server error' });
    }
});


// @desc Like a post
// @route UPDATE /api/like/ {postId,userId}
// @access Private
const unlike = asyncHandler(async (req, res) => {
    try {
        const userId = req.body.userId;

        const content = await contentSchema.findOne({ likes: userId });

        const updatedContent = await contentSchema.findOneAndUpdate(
            { _id: content },
            { $pull: { likes: userId } },
            { new: true }
        );

        if (!updatedContent) {
            return res.status(404).json({ error: 'User not found in the likes array' });
        }
        
        res.status(200).json({ likes: updatedContent.likes }); // Send the updated likes array in the response
    } catch (error) {
        console.error(error); // Log any errors to the console for debugging
        res.status(500).json({ error: 'Server error' });
    }
}); 


// @desc Update Top
// @route UPDATE /api/top/:id
// @access Private

const updateTop10 = asyncHandler(async (req, res) => {
    try {
        const topId = req.params.id;
        
        // Check if the top document with the given ID exists
        const top = await Top10.findById(topId);

        if (!top) {
            res.status(400).json({ error: 'Document does not exit!' });
            return;
        }

        // Update the fields you want to change
        if (req.body.thumbnail) {
            top.thumbnail = req.body.thumbnail;
        }
        if (req.body.shortPreview) {
            top.shortPreview = req.body.shortPreview;
        }
        if (req.body.descripton) {
            top.descripton = req.body.descripton;
        }
        if (req.body.credit) {
            top.credit = req.body.credit;
        }
        if (req.body.category) {
            top.category = req.body.category;
        }
        if (req.body.title) {
            top.title = req.body.title;
        }
        if (req.body.video) {
            top.title = req.body.video;
        }

        // Save the updated document
        await top.save();

        res.status(200).json(top);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
})

// @desc Delete content
// @route DELETE /api/content/:id
// @access Private


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
        const videoPublicId = content.video && content.cloudinary_id;
        if (videoPublicId) {
            await cloudinary.uploader.destroy(videoPublicId);
        }

        // Delete the thumbnail from Cloudinary
        const thumbnailPublicId = content.thumbnail && content.thumbnail.split('/').pop();
        if (thumbnailPublicId) {
            await cloudinary.uploader.destroy(thumbnailPublicId);
        }

        // Delete the content from MongoDB
        await content.deleteOne();

        console.log('Content deleted:', content);

        res.status(200).json({ message: 'Content deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});






 module.exports = {
    getContent,
    updateTop10,
    postLikes,
    unlike,
    createContent,
    deleteContent
 }
