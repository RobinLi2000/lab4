const Fire = function(ctx, x, y) {
    const fire = {
        icon: { x: 208, y:  112, width: 16, height: 16, count: 1, timing: 200, loop: true }
    }

    const sprite = Sprite(ctx, x, y);

    sprite.setSequence(fire.icon)
          .setScale(2)
          .setShadowScale({ x: 0.75, y: 0.2 })
          .useSheet("images/object_sprites.png");

    return {
        
            
        
        //getBoundingBox: sprite.getBoundingBox,
        draw: sprite.draw,
        update: sprite.update
    };
}