
const asyncHandler = require ('express-async-handler');
const contentSchema = require('../models/contentModel');

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
// @access Private
 
const postContent = asyncHandler(async (req, res) => {
    try {
        
        if (!req.body.thumbnail || !req.body.shortPreview || !req.body.description || !req.body.credit || !req.body.title || !req.body.category || !req.body.video ) {
            res.status(400).json({ error: 'Please ensure no field is empty!' });
            return;
        }

        const Contents = await contentSchema.create({ 
            thumbnail: req.body.thumbnail,
            shortPreview: req.body.shortPreview,
            description: req.body.description,
            credit: req.body.credit,
            category: req.body.category,
            title: req.body.title, 
            video: req.body.video
        });
 
        res.status(200).json(Contents);
    } catch (error) {
        console.error(error); // Log any errors to the console for debugging
        res.status(500).json({ error: 'Server error' });
    }
}); 

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

// @desc Delete Top
// @route DELETE /api/top/:id
// @access Private

const deleteTop10 = asyncHandler(async (req, res) => {
    try {
        const topId = req.params.id; 
        console.log(topId)
        const top = await Top10.findById(topId);

        if (!top) {
            res.status(400).json({ error: 'Document not found!' });
            return;
        }

        // Delete the top document
        await top.remove()
        
        res.status(200).json({ id: req.params.id });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
})


 module.exports = {
    getContent,
    postContent,
    updateTop10,
    deleteTop10,
    postLikes,
    unlike
 }
