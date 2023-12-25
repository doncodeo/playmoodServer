
const asyncHandler = require ('express-async-handler')

const Top10 = require('../models/top10Model')

// @desc Get Top10
// @route GET /api/top10
// @access Private

const getTop10 = asyncHandler(async (req, res) => {
      
    const tops10 = await Top10.find()

    res.status(200).json(tops10)
})

// @desc Post Top
// @route POST /api/top
// @access Private
 
const postTop10 = asyncHandler(async (req, res) => {
    try {
        
        if (!req.body.thumbnail || !req.body.shortPreview || !req.body.description || !req.body.credit || !req.body.title || !req.body.category || !req.body.video ) {
          
            res.status(400).json({ error: 'Please ensure no field is empty!' });
            return;
        }

        const top = await Top10.create({ 
            thumbnail: req.body.thumbnail,
            shortPreview: req.body.shortPreview,
            description: req.body.description,
            credit: req.body.credit,
            category: req.body.category,
            title: req.body.title, 
            video: req.body.video
        });
 
        res.status(200).json(top);
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
    getTop10,
    postTop10,
    updateTop10,
    deleteTop10,
 }